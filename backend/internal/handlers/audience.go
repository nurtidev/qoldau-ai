package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
)

// AudienceHandler powers the "Reach calculator" feature:
//   • count entrepreneurs matching the filters
//   • return breakdowns by region / sector / MSB category
//   • broadcast a personalized notification to all matched users
type AudienceHandler struct {
	db *sqlx.DB
}

func NewAudienceHandler(db *sqlx.DB) *AudienceHandler {
	return &AudienceHandler{db: db}
}

// AudienceFilters mirrors the JSON shape the admin sends from the drawer.
// Pointers distinguish "field omitted" from "field set to zero".
type AudienceFilters struct {
	Sectors              []string `json:"sectors"`
	Regions              []string `json:"regions"`
	MsbCategories        []string `json:"msb_categories"`
	MinBusinessAgeMonths *int     `json:"min_business_age_months"`
	MaxBusinessAgeMonths *int     `json:"max_business_age_months"`
	MinRevenue           *int64   `json:"min_revenue"`
	MaxRevenue           *int64   `json:"max_revenue"`
	MinOwnerAge          *int     `json:"min_owner_age"`
	MaxOwnerAge          *int     `json:"max_owner_age"`
	ExcludeTaxDebt       bool     `json:"exclude_tax_debt"`
	ExcludeRiskRegister  bool     `json:"exclude_risk_register"`
}

// buildWhere constructs the dynamic SQL WHERE fragment (without the WHERE keyword)
// plus the positional arguments. Always includes the baseline filter:
// role='user' AND is_synthetic=TRUE — so the admin user and real test logins
// don't pollute audience counts.
func (f AudienceFilters) buildWhere() (string, []interface{}) {
	conds := []string{"role = 'user'", "is_synthetic = TRUE"}
	args := []interface{}{}
	i := 1

	addList := func(col string, vals []string) {
		if len(vals) == 0 {
			return
		}
		placeholders := make([]string, len(vals))
		for k, v := range vals {
			placeholders[k] = fmt.Sprintf("$%d", i)
			args = append(args, v)
			i++
		}
		conds = append(conds, fmt.Sprintf("%s IN (%s)", col, strings.Join(placeholders, ",")))
	}
	addList("sector", f.Sectors)
	addList("region", f.Regions)
	addList("msb_category", f.MsbCategories)

	addRange := func(col string, min, max interface{}, minNil, maxNil bool) {
		if !minNil {
			conds = append(conds, fmt.Sprintf("%s >= $%d", col, i))
			args = append(args, min)
			i++
		}
		if !maxNil {
			conds = append(conds, fmt.Sprintf("%s <= $%d", col, i))
			args = append(args, max)
			i++
		}
	}
	if f.MinBusinessAgeMonths != nil {
		addRange("business_age_months", *f.MinBusinessAgeMonths, nil, false, true)
	}
	if f.MaxBusinessAgeMonths != nil {
		addRange("business_age_months", nil, *f.MaxBusinessAgeMonths, true, false)
	}
	if f.MinRevenue != nil {
		addRange("annual_revenue", *f.MinRevenue, nil, false, true)
	}
	if f.MaxRevenue != nil {
		addRange("annual_revenue", nil, *f.MaxRevenue, true, false)
	}
	if f.MinOwnerAge != nil {
		addRange("owner_age", *f.MinOwnerAge, nil, false, true)
	}
	if f.MaxOwnerAge != nil {
		addRange("owner_age", nil, *f.MaxOwnerAge, true, false)
	}

	if f.ExcludeTaxDebt {
		conds = append(conds, "has_tax_debt = FALSE")
	}
	if f.ExcludeRiskRegister {
		conds = append(conds, "in_risk_register = FALSE")
	}

	return strings.Join(conds, " AND "), args
}

type breakdownRow struct {
	Key   string `db:"key"   json:"key"`
	Count int    `db:"count" json:"count"`
}

type audienceMatchResp struct {
	Total    int            `json:"total"`
	ByRegion []breakdownRow `json:"by_region"`
	BySector []breakdownRow `json:"by_sector"`
	ByMsb    []breakdownRow `json:"by_msb"`
	Sample   []sampleUser   `json:"sample"`
}

type sampleUser struct {
	FullName    string  `db:"full_name"      json:"full_name"`
	OrgName     *string `db:"org_name"       json:"org_name,omitempty"`
	Region      *string `db:"region"         json:"region,omitempty"`
	Sector      *string `db:"sector"         json:"sector,omitempty"`
	MsbCategory *string `db:"msb_category"   json:"msb_category,omitempty"`
}

// Match returns the audience count + breakdowns for the given filters.
// POST /api/services/:id/audience
//
// service_id is reserved for future use (logging, history) — currently
// the calculation is service-independent and reusable.
func (h *AudienceHandler) Match(w http.ResponseWriter, r *http.Request) {
	var filters AudienceFilters
	if err := decode(r, &filters); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid filters")
		return
	}
	where, args := filters.buildWhere()

	resp := audienceMatchResp{
		ByRegion: []breakdownRow{},
		BySector: []breakdownRow{},
		ByMsb:    []breakdownRow{},
		Sample:   []sampleUser{},
	}

	if err := h.db.Get(&resp.Total,
		"SELECT COUNT(*) FROM users WHERE "+where, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "audience count failed")
		return
	}

	// Breakdowns — top 5 each. SeqScan over 3k rows is sub-50ms.
	if err := h.db.Select(&resp.ByRegion, `
		SELECT region AS key, COUNT(*) AS count
		FROM users WHERE `+where+`
		GROUP BY region ORDER BY count DESC LIMIT 5`, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "region breakdown failed")
		return
	}
	if err := h.db.Select(&resp.BySector, `
		SELECT sector AS key, COUNT(*) AS count
		FROM users WHERE `+where+`
		GROUP BY sector ORDER BY count DESC LIMIT 8`, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "sector breakdown failed")
		return
	}
	if err := h.db.Select(&resp.ByMsb, `
		SELECT msb_category AS key, COUNT(*) AS count
		FROM users WHERE `+where+`
		GROUP BY msb_category ORDER BY count DESC`, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "msb breakdown failed")
		return
	}

	// Sample 5 random matches — for "пример аудитории" preview in UI
	if err := h.db.Select(&resp.Sample, `
		SELECT full_name, org_name, region, sector, msb_category
		FROM users WHERE `+where+`
		ORDER BY random() LIMIT 5`, args...); err != nil {
		// non-fatal
		resp.Sample = []sampleUser{}
	}

	respond(w, http.StatusOK, resp)
}

// Broadcast inserts one notification per matching user.
// Personalization: occurrences of {{full_name}} and {{org_name}} in the
// message body are replaced server-side per recipient.
//
// POST /api/services/:id/broadcast
func (h *AudienceHandler) Broadcast(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := middleware.ClaimsFromCtx(r.Context())
	_ = claims // currently audited via chi middleware logger

	// Resolve service title for the notification subject.
	var serviceTitle string
	if err := h.db.Get(&serviceTitle, "SELECT title FROM services WHERE id = $1", id); err != nil {
		respondErr(w, http.StatusNotFound, "service not found")
		return
	}

	var req struct {
		Filters AudienceFilters `json:"filters"`
		Title   string          `json:"title"`
		Message string          `json:"message"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid broadcast payload")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		req.Title = "Подходящая программа: " + serviceTitle
	}
	if strings.TrimSpace(req.Message) == "" {
		respondErr(w, http.StatusBadRequest, "message is required")
		return
	}

	where, args := req.Filters.buildWhere()

	// Insert one notification per recipient with server-side placeholder
	// replacement. {{full_name}} → users.full_name, {{org_name}} → users.org_name.
	titleArg := "$" + itoa(len(args)+1)
	msgArg := "$" + itoa(len(args)+2)
	args = append(args, req.Title, req.Message)

	query := fmt.Sprintf(`
		INSERT INTO notifications (user_id, title, message)
		SELECT
		  id,
		  %s,
		  REPLACE(REPLACE(%s,
		    '{{full_name}}', COALESCE(full_name, '')),
		    '{{org_name}}',  COALESCE(org_name,  ''))
		FROM users
		WHERE %s
	`, titleArg, msgArg, where)

	res, err := h.db.Exec(query, args...)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "broadcast failed: "+err.Error())
		return
	}
	rows, _ := res.RowsAffected()

	respond(w, http.StatusOK, map[string]interface{}{
		"sent_to":      rows,
		"service_id":   id,
		"service_name": serviceTitle,
	})
}

// Snapshot returns lightweight metadata used by the drawer on open:
// total entrepreneurs in the synthetic audience + the list of distinct
// regions/sectors that exist in the data (so the UI doesn't hardcode them).
//
// GET /api/audience/snapshot
func (h *AudienceHandler) Snapshot(w http.ResponseWriter, r *http.Request) {
	var resp struct {
		TotalAudience int      `json:"total_audience"`
		Regions       []string `json:"regions"`
		Sectors       []string `json:"sectors"`
		MsbCategories []string `json:"msb_categories"`
	}
	if err := h.db.Get(&resp.TotalAudience,
		"SELECT COUNT(*) FROM users WHERE role='user' AND is_synthetic=TRUE"); err != nil {
		respondErr(w, http.StatusInternalServerError, "snapshot failed")
		return
	}
	_ = h.db.Select(&resp.Regions,
		`SELECT DISTINCT region FROM users
		 WHERE is_synthetic=TRUE AND region IS NOT NULL
		 ORDER BY region`)
	_ = h.db.Select(&resp.Sectors,
		`SELECT DISTINCT sector FROM users
		 WHERE is_synthetic=TRUE AND sector IS NOT NULL
		 ORDER BY sector`)
	_ = h.db.Select(&resp.MsbCategories,
		`SELECT DISTINCT msb_category FROM users
		 WHERE is_synthetic=TRUE AND msb_category IS NOT NULL
		 ORDER BY msb_category`)
	respond(w, http.StatusOK, resp)
}
