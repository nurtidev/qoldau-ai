package handlers

import (
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qolday-ai/backend/internal/models"
)

type LeadsHandler struct {
	db *sqlx.DB
}

func NewLeadsHandler(db *sqlx.DB) *LeadsHandler {
	return &LeadsHandler{db: db}
}

// Create — public endpoint for the "Перезвоните мне" widget. No auth.
func (h *LeadsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string  `json:"name"`
		Phone     string  `json:"phone"`
		ServiceID *string `json:"service_id"`
		Message   string  `json:"message"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid request")
		return
	}

	name := strings.TrimSpace(req.Name)
	phone := strings.TrimSpace(req.Phone)
	if name == "" || phone == "" {
		respondErr(w, http.StatusBadRequest, "name and phone required")
		return
	}
	if len(phone) < 6 || len(phone) > 50 {
		respondErr(w, http.StatusBadRequest, "phone has invalid length")
		return
	}

	var serviceID interface{}
	if req.ServiceID != nil && *req.ServiceID != "" {
		serviceID = *req.ServiceID
	}

	var lead models.Lead
	err := h.db.QueryRowx(
		`INSERT INTO leads (name, phone, service_id, message)
		 VALUES ($1, $2, $3, $4) RETURNING *`,
		name, phone, serviceID, nullStr(req.Message),
	).StructScan(&lead)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to save lead")
		return
	}
	respond(w, http.StatusCreated, lead)
}

// List — admin view of all leads, newest first.
func (h *LeadsHandler) List(w http.ResponseWriter, r *http.Request) {
	leads := make([]models.LeadWithService, 0)
	err := h.db.Select(&leads,
		`SELECT l.*, s.title AS service_title
		 FROM leads l
		 LEFT JOIN services s ON s.id = l.service_id
		 ORDER BY l.created_at DESC
		 LIMIT 200`)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch leads")
		return
	}
	respond(w, http.StatusOK, leads)
}
