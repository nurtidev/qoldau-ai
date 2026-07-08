package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type AnalyticsHandler struct {
	db *sqlx.DB
}

func NewAnalyticsHandler(db *sqlx.DB) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

func (h *AnalyticsHandler) Summary(w http.ResponseWriter, r *http.Request) {
	var totalApplications, totalServices, totalUsers int
	var pendingApplications int

	h.db.Get(&totalApplications, `SELECT COUNT(*) FROM applications`)
	h.db.Get(&totalServices, `SELECT COUNT(*) FROM services`)
	h.db.Get(&totalUsers, `SELECT COUNT(*) FROM users`)
	h.db.Get(&pendingApplications,
		`SELECT COUNT(*) FROM applications WHERE status IN ('submitted','in_review')`)

	type statusCount struct {
		Status string `db:"status" json:"status"`
		Count  int    `db:"count"  json:"count"`
	}
	var byStatus []statusCount
	h.db.Select(&byStatus,
		`SELECT status, COUNT(*) as count FROM applications GROUP BY status ORDER BY count DESC`)

	respond(w, http.StatusOK, map[string]interface{}{
		"total_applications":   totalApplications,
		"total_services":       totalServices,
		"total_users":          totalUsers,
		"pending_applications": pendingApplications,
		"by_status":            byStatus,
	})
}

type gradeCount struct {
	Grade string `db:"grade" json:"grade"`
	Count int    `db:"count" json:"count"`
}

type draftRow struct {
	ID           string       `db:"id"`
	ServiceTitle string       `db:"service_title"`
	UserName     string       `db:"user_name"`
	UpdatedAt    time.Time    `db:"updated_at"`
	FormData     models.JSONB `db:"form_data"`
}

type draftItem struct {
	ID                 string    `json:"id"`
	ServiceTitle       string    `json:"service_title"`
	UserName           string    `json:"user_name"`
	UpdatedOrCreatedAt time.Time `json:"updated_or_created_at"`
	Amount             float64   `json:"amount"`
}

// amountFieldRe matches JSONB keys that look like a monetary field
// (f_lease_amount, f_loan_amount, requested_amount, loan_sum, …) — a
// heuristic since form_data has no fixed schema across services.
var amountFieldRe = regexp.MustCompile(`(?i)(amount|sum)`)

// extractDraftAmount scans a draft's form_data for numeric values whose key
// looks like a monetary field and returns the largest one. Deterministic on
// purpose: Go map iteration order is random, so "first match" would flap
// between requests when a form holds several monetary fields (loan amount +
// guarantee sum, …). Returns 0 when nothing matches — JSONB values decode as
// float64/string/bool/nil/map/slice, so only the numeric-ish cases are handled.
func extractDraftAmount(formData models.JSONB) float64 {
	var best float64
	for k, v := range formData {
		if strings.HasPrefix(k, "_") || !amountFieldRe.MatchString(k) {
			continue
		}
		var f float64
		switch n := v.(type) {
		case float64:
			f = n
		case string:
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(n), 64); err == nil {
				f = parsed
			}
		}
		if f > best {
			best = f
		}
	}
	return best
}

// Quality powers the "Качество входящего потока" + "Брошенные черновики"
// admin analytics widgets. Both read only real (non-synthetic) applications —
// the 005/006 synthetic seed rows exist purely to feed the funnel/audience
// widgets and would otherwise flood the drafts table with noise.
// GET /api/analytics/quality
func (h *AnalyticsHandler) Quality(w http.ResponseWriter, r *http.Request) {
	grades := make([]gradeCount, 0)
	if err := h.db.Select(&grades, `
		SELECT COALESCE(form_data->'_prescore'->>'band', 'none') AS grade, COUNT(*) AS count
		FROM applications
		WHERE status != 'draft' AND is_synthetic = FALSE
		GROUP BY grade
		ORDER BY grade`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch grade distribution")
		return
	}

	rows := make([]draftRow, 0)
	if err := h.db.Select(&rows, `
		SELECT a.id, s.title AS service_title, u.full_name AS user_name,
		       a.updated_at, a.form_data
		FROM applications a
		JOIN services s ON s.id = a.service_id
		JOIN users u ON u.id = a.user_id
		WHERE a.status = 'draft' AND a.is_synthetic = FALSE
		ORDER BY a.updated_at DESC`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch drafts")
		return
	}

	items := make([]draftItem, 0, len(rows))
	var amountSum float64
	for _, row := range rows {
		amount := extractDraftAmount(row.FormData)
		amountSum += amount
		items = append(items, draftItem{
			ID:                 row.ID,
			ServiceTitle:       row.ServiceTitle,
			UserName:           row.UserName,
			UpdatedOrCreatedAt: row.UpdatedAt,
			Amount:             amount,
		})
	}

	respond(w, http.StatusOK, map[string]interface{}{
		"grades": grades,
		"drafts": map[string]interface{}{
			"count":      len(items),
			"amount_sum": amountSum,
			"items":      items,
		},
	})
}
