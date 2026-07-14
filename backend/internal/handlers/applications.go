package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type ApplicationsHandler struct {
	db *sqlx.DB
}

func NewApplicationsHandler(db *sqlx.DB) *ApplicationsHandler {
	return &ApplicationsHandler{db: db}
}

func (h *ApplicationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	var req struct {
		ServiceID string       `json:"service_id"`
		FormData  models.JSONB `json:"form_data"`
	}
	if err := decode(r, &req); err != nil || req.ServiceID == "" {
		respondErr(w, http.StatusBadRequest, "service_id required")
		return
	}

	var app models.Application
	err := h.db.QueryRowx(
		`INSERT INTO applications (service_id, user_id, form_data, status)
		 VALUES ($1, $2, $3, 'submitted') RETURNING *`,
		req.ServiceID, claims.UserID, req.FormData,
	).StructScan(&app)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create application")
		return
	}

	// Create notification
	h.db.Exec(
		`INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
		claims.UserID,
		"Заявка подана",
		"Ваша заявка успешно подана и находится на рассмотрении.",
	)

	respond(w, http.StatusCreated, app)
}

func (h *ApplicationsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())

	apps := make([]models.ApplicationWithService, 0)
	var err error

	if claims.Role == "admin" {
		// Admin review queue = submitted applications only. Users' unfinished
		// drafts are surfaced in the "Брошенные черновики" analytics widget
		// (GET /api/analytics/quality), not in the queue.
		err = h.db.Select(&apps,
			`SELECT a.*, s.title AS service_title,
			        u.full_name AS applicant_name, COALESCE(u.org_name, '') AS applicant_org
			 FROM applications a
			 JOIN services s ON a.service_id = s.id
			 JOIN users u ON u.id = a.user_id
			 WHERE a.is_synthetic = FALSE AND a.status != 'draft'
			 ORDER BY a.created_at DESC`)
	} else {
		err = h.db.Select(&apps,
			`SELECT a.*, s.title AS service_title
			 FROM applications a JOIN services s ON a.service_id = s.id
			 WHERE a.user_id = $1 AND a.is_synthetic = FALSE
			 ORDER BY a.created_at DESC`,
			claims.UserID)
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch applications")
		return
	}
	respond(w, http.StatusOK, apps)
}

func (h *ApplicationsHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	id := chi.URLParam(r, "id")

	var app models.ApplicationWithService
	err := h.db.Get(&app,
		`SELECT a.*, s.title AS service_title
		 FROM applications a JOIN services s ON a.service_id = s.id
		 WHERE a.id = $1`, id)
	if err != nil {
		respondErr(w, http.StatusNotFound, "application not found")
		return
	}
	if claims.Role != "admin" && app.UserID != claims.UserID {
		respondErr(w, http.StatusForbidden, "forbidden")
		return
	}
	respond(w, http.StatusOK, app)
}

func (h *ApplicationsHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Status  string `json:"status"`
		Message string `json:"message"`
	}
	if err := decode(r, &req); err != nil || req.Status == "" {
		respondErr(w, http.StatusBadRequest, "status required")
		return
	}

	validStatuses := map[string]bool{
		"draft": true, "submitted": true, "in_review": true,
		"docs_requested": true, "approved": true, "rejected": true,
	}
	if !validStatuses[req.Status] {
		respondErr(w, http.StatusBadRequest, "invalid status")
		return
	}

	var app models.Application
	var err error
	if req.Status == string(models.AppDocsRequested) {
		// Store the admin's request message alongside the status change.
		err = h.db.QueryRowx(
			`UPDATE applications SET status = $1, request_message = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
			req.Status, req.Message, time.Now(), id,
		).StructScan(&app)
	} else {
		err = h.db.QueryRowx(
			`UPDATE applications SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *`,
			req.Status, time.Now(), id,
		).StructScan(&app)
	}
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusNotFound, "application not found")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	// Notify applicant
	if req.Status == string(models.AppDocsRequested) {
		msg := "По вашей заявке запрошены дополнительные данные."
		if m := strings.TrimSpace(req.Message); m != "" {
			msg = "По вашей заявке запрошены дополнительные данные: " + m
		}
		h.db.Exec(
			`INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
			app.UserID, "Требуются дополнительные данные", msg,
		)
	} else {
		statusMessages := map[string]string{
			"approved":  "Ваша заявка одобрена.",
			"rejected":  "Ваша заявка отклонена.",
			"in_review": "Ваша заявка взята в рассмотрение.",
		}
		if msg, ok := statusMessages[req.Status]; ok {
			h.db.Exec(
				`INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
				app.UserID, "Статус заявки изменён", msg,
			)
		}
	}

	respond(w, http.StatusOK, app)
}

// SubmitStage2 lets the applicant provide the additional data/documents the
// admin requested (status docs_requested). The new form_data is merged over
// the existing JSONB, the application advances to stage 2 and returns to
// in_review.
func (h *ApplicationsHandler) SubmitStage2(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	id := chi.URLParam(r, "id")

	var req struct {
		FormData models.JSONB `json:"form_data"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "form_data required")
		return
	}

	var app models.Application
	if err := h.db.Get(&app, `SELECT * FROM applications WHERE id = $1`, id); err != nil {
		respondErr(w, http.StatusNotFound, "application not found")
		return
	}
	if app.UserID != claims.UserID {
		respondErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if app.Status != models.AppDocsRequested {
		respondErr(w, http.StatusBadRequest, "application is not awaiting additional data")
		return
	}

	// Merge stage-2 data over the existing form_data (stage-2 keys win).
	merged := app.FormData
	if merged == nil {
		merged = models.JSONB{}
	}
	for k, v := range req.FormData {
		merged[k] = v
	}

	var updated models.Application
	err := h.db.QueryRowx(
		`UPDATE applications
		 SET form_data = $1, stage = 2, status = 'in_review', updated_at = $2
		 WHERE id = $3 RETURNING *`,
		merged, time.Now(), id,
	).StructScan(&updated)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to submit additional data")
		return
	}

	h.db.Exec(
		`INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
		app.UserID, "Данные отправлены на рассмотрение",
		"Дополнительные данные по заявке отправлены на рассмотрение.",
	)

	respond(w, http.StatusOK, updated)
}

// Nudge sends the draft's owner a reminder notification to finish their
// application. Powers the "Брошенные черновики" admin analytics widget —
// re-invoking it simply creates another notification (MVP, no dedup/cooldown).
// POST /api/applications/{id}/nudge
func (h *ApplicationsHandler) Nudge(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var app models.ApplicationWithService
	err := h.db.Get(&app, `
		SELECT a.*, s.title AS service_title
		FROM applications a JOIN services s ON s.id = a.service_id
		WHERE a.id = $1`, id)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusNotFound, "application not found")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch application")
		return
	}
	if app.Status != models.AppDraft {
		respondErr(w, http.StatusBadRequest, "application is not a draft")
		return
	}

	msg := fmt.Sprintf(
		"Вы остановились при заполнении заявки на «%s». Осталось совсем немного — завершите подачу в личном кабинете.",
		app.ServiceTitle,
	)
	if _, err := h.db.Exec(
		`INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)`,
		app.UserID, "Заявка ждёт завершения", msg,
	); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to send reminder")
		return
	}

	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
