package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type ServicesHandler struct {
	db *sqlx.DB
}

func NewServicesHandler(db *sqlx.DB) *ServicesHandler {
	return &ServicesHandler{db: db}
}

func (h *ServicesHandler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	orgName := r.URL.Query().Get("org_name")

	query := `SELECT * FROM services WHERE 1=1`
	args := []interface{}{}
	i := 1

	if category != "" {
		query += ` AND category = $` + itoa(i)
		args = append(args, category)
		i++
	}
	if orgName != "" {
		query += ` AND org_name = $` + itoa(i)
		args = append(args, orgName)
		i++
	}

	// Non-admins only see published
	claims := middleware.ClaimsFromCtx(r.Context())
	if claims == nil || (claims.Role != "admin" && claims.Role != "author") {
		query += ` AND status = 'published'`
	}

	query += ` ORDER BY created_at DESC`

	services := make([]models.Service, 0)
	if err := h.db.Select(&services, query, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch services")
		return
	}
	respond(w, http.StatusOK, services)
}

func (h *ServicesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var service models.Service
	if err := h.db.Get(&service, `SELECT * FROM services WHERE id = $1`, id); err != nil {
		respondErr(w, http.StatusNotFound, "service not found")
		return
	}
	// Non-admins/authors cannot view drafts by direct ID
	claims := middleware.ClaimsFromCtx(r.Context())
	if service.Status == models.ServiceDraft {
		if claims == nil || (claims.Role != "admin" && claims.Role != "author") {
			respondErr(w, http.StatusNotFound, "service not found")
			return
		}
	}
	respond(w, http.StatusOK, service)
}

func (h *ServicesHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	var req struct {
		Title            string       `json:"title"`
		Description      string       `json:"description"`
		Category         string       `json:"category"`
		OrgName          string       `json:"org_name"`
		FormSchema       models.JSONB `json:"form_schema"`
		EligibilityRules models.JSONB `json:"eligibility_rules"`
		InterestRate     *float64     `json:"interest_rate"`
		MaxAmount        *int64       `json:"max_amount"`
		MaxTermMonths    *int         `json:"max_term_months"`
	}
	if err := decode(r, &req); err != nil || req.Title == "" {
		respondErr(w, http.StatusBadRequest, "title required")
		return
	}

	if req.EligibilityRules == nil {
		req.EligibilityRules = models.JSONB{"rules": []interface{}{}}
	}

	var service models.Service
	err := h.db.QueryRowx(
		`INSERT INTO services (title, description, category, org_name, form_schema, eligibility_rules,
		    interest_rate, max_amount, max_term_months, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
		req.Title, nullStr(req.Description), nullStr(req.Category),
		nullStr(req.OrgName), req.FormSchema, req.EligibilityRules,
		req.InterestRate, req.MaxAmount, req.MaxTermMonths, claims.UserID,
	).StructScan(&service)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create service")
		return
	}
	respond(w, http.StatusCreated, service)
}

func (h *ServicesHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Title            string       `json:"title"`
		Description      string       `json:"description"`
		Category         string       `json:"category"`
		OrgName          string       `json:"org_name"`
		FormSchema       models.JSONB `json:"form_schema"`
		EligibilityRules models.JSONB `json:"eligibility_rules"`
		InterestRate     *float64     `json:"interest_rate"`
		MaxAmount        *int64       `json:"max_amount"`
		MaxTermMonths    *int         `json:"max_term_months"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.EligibilityRules == nil {
		req.EligibilityRules = models.JSONB{"rules": []interface{}{}}
	}

	var service models.Service
	err := h.db.QueryRowx(
		`UPDATE services SET title=$1, description=$2, category=$3, org_name=$4,
		   form_schema=$5, eligibility_rules=$6,
		   interest_rate=$7, max_amount=$8, max_term_months=$9
		 WHERE id=$10 RETURNING *`,
		req.Title, nullStr(req.Description), nullStr(req.Category),
		nullStr(req.OrgName), req.FormSchema, req.EligibilityRules,
		req.InterestRate, req.MaxAmount, req.MaxTermMonths, id,
	).StructScan(&service)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to update service")
		return
	}
	respond(w, http.StatusOK, service)
}

func (h *ServicesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.db.Exec(`DELETE FROM services WHERE id = $1`, id); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to delete service")
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ServicesHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var service models.Service
	err := h.db.QueryRowx(
		`UPDATE services SET status = 'published' WHERE id = $1 RETURNING *`, id,
	).StructScan(&service)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to publish service")
		return
	}
	respond(w, http.StatusOK, service)
}

func itoa(i int) string {
	return strconv.Itoa(i)
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
