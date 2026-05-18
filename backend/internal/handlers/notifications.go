package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type NotificationsHandler struct {
	db *sqlx.DB
}

func NewNotificationsHandler(db *sqlx.DB) *NotificationsHandler {
	return &NotificationsHandler{db: db}
}

func (h *NotificationsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	notifs := make([]models.Notification, 0)
	if err := h.db.Select(&notifs,
		`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
		claims.UserID); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch notifications")
		return
	}
	respond(w, http.StatusOK, notifs)
}

func (h *NotificationsHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	id := chi.URLParam(r, "id")
	_, err := h.db.Exec(
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
		id, claims.UserID,
	)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to update notification")
		return
	}
	respond(w, http.StatusOK, map[string]bool{"ok": true})
}
