package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
)

// FunnelHandler powers the program-level analytics feature:
//   - track service views (POST /api/services/:id/view)
//   - track step events (POST /api/applications/:id/event)
//   - aggregate funnel + drilldown insight (GET /api/services/:id/funnel)
type FunnelHandler struct {
	db *sqlx.DB
}

func NewFunnelHandler(db *sqlx.DB) *FunnelHandler {
	return &FunnelHandler{db: db}
}

// ─── Event tracking ─────────────────────────────────────────────────────────

// LogView records that a user opened a service detail page.
// Anonymous-friendly: user_id may come from JWT claims if present, else NULL.
func (h *FunnelHandler) LogView(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		respondErr(w, http.StatusBadRequest, "service id required")
		return
	}

	var userID interface{}
	if claims := middleware.ClaimsFromCtx(r.Context()); claims != nil && claims.UserID != "" {
		userID = claims.UserID
	}

	_, err := h.db.Exec(
		`INSERT INTO service_views (service_id, user_id) VALUES ($1, $2)`,
		serviceID, userID,
	)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to log view")
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// LogEvent records a step transition within an application.
// Body: { step_id, step_index, event_type, last_field_id?, last_field_value? }
func (h *FunnelHandler) LogEvent(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	var req struct {
		StepID         string `json:"step_id"`
		StepIndex      int    `json:"step_index"`
		EventType      string `json:"event_type"`
		LastFieldID    string `json:"last_field_id,omitempty"`
		LastFieldValue string `json:"last_field_value,omitempty"`
	}
	if err := decode(r, &req); err != nil || req.StepID == "" || req.EventType == "" {
		respondErr(w, http.StatusBadRequest, "step_id and event_type required")
		return
	}
	switch req.EventType {
	case "entered", "completed", "abandoned":
	default:
		respondErr(w, http.StatusBadRequest, "invalid event_type")
		return
	}

	_, err := h.db.Exec(
		`INSERT INTO application_events
		   (application_id, step_id, step_index, event_type, last_field_id, last_field_value)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''))`,
		appID, req.StepID, req.StepIndex, req.EventType, req.LastFieldID, req.LastFieldValue,
	)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to log event")
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ─── Funnel aggregation ─────────────────────────────────────────────────────

type funnelStage struct {
	Stage   string `json:"stage"`
	Label   string `json:"label"`
	Count   int    `json:"count"`
	DropPct int    `json:"drop_pct"` // % drop from previous stage (0 for first)
}

type drilldownField struct {
	FieldID        string                 `json:"field_id"`
	FieldLabel     string                 `json:"field_label"`
	AbandonedCount int                    `json:"abandoned_count"`
	AbandonedPct   int                    `json:"abandoned_pct"`
	Stats          map[string]interface{} `json:"stats"`
	Insight        string                 `json:"insight"`
	AudienceFix    map[string]interface{} `json:"audience_fix,omitempty"`
}

type biggestDrop struct {
	Stage          string           `json:"stage"`
	StageLabel     string           `json:"stage_label"`
	AbandonedCount int              `json:"abandoned_count"`
	TopFields      []drilldownField `json:"top_fields"`
}

type funnelResponse struct {
	ServiceID    string        `json:"service_id"`
	ServiceTitle string        `json:"service_title"`
	Funnel       []funnelStage `json:"funnel"`
	BiggestDrop  *biggestDrop  `json:"biggest_drop,omitempty"`
}

type formStep struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Fields []struct {
		ID    string `json:"id"`
		Type  string `json:"type"`
		Label string `json:"label"`
	} `json:"fields"`
}

// funnelCounts holds the raw lifecycle aggregates for one service.
type funnelCounts struct {
	Views           int
	Started         int            // total applications (any status)
	StatusCounts    map[string]int // count per application_status
	CompletedByStep map[string]int // distinct apps that completed each step_id
}

// gatherFunnelCounts computes view / start / status / step-completion counts for
// one service. Shared by the funnel endpoint (Funnel) and the AI service-insights
// endpoint so both read the same lifecycle numbers without duplicating SQL.
func gatherFunnelCounts(db *sqlx.DB, serviceID string) funnelCounts {
	fc := funnelCounts{StatusCounts: map[string]int{}, CompletedByStep: map[string]int{}}

	_ = db.Get(&fc.Views,
		`SELECT COUNT(*) FROM service_views WHERE service_id = $1`, serviceID)
	_ = db.Get(&fc.Started,
		`SELECT COUNT(*) FROM applications WHERE service_id = $1`, serviceID)

	rows, err := db.Query(
		`SELECT status::text, COUNT(*) FROM applications
		 WHERE service_id = $1 GROUP BY status`, serviceID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			var c int
			if err := rows.Scan(&s, &c); err == nil {
				fc.StatusCounts[s] = c
			}
		}
	}

	type stepCount struct {
		StepID string `db:"step_id"`
		Count  int    `db:"count"`
	}
	stepCounts := []stepCount{}
	_ = db.Select(&stepCounts, `
		SELECT step_id, COUNT(DISTINCT application_id) AS count
		FROM application_events ev
		JOIN applications a ON a.id = ev.application_id
		WHERE a.service_id = $1 AND ev.event_type = 'completed'
		GROUP BY step_id`, serviceID)
	for _, sc := range stepCounts {
		fc.CompletedByStep[sc.StepID] = sc.Count
	}

	return fc
}

// Funnel returns the aggregated lifecycle funnel for one service plus
// a drilldown describing the largest drop-off.
// GET /api/services/:id/funnel
func (h *FunnelHandler) Funnel(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		respondErr(w, http.StatusBadRequest, "service id required")
		return
	}

	// 1. Resolve service title + form structure
	var (
		title      string
		schemaJSON []byte
	)
	if err := h.db.QueryRow(
		`SELECT title, form_schema FROM services WHERE id = $1`, serviceID,
	).Scan(&title, &schemaJSON); err != nil {
		if err == sql.ErrNoRows {
			respondErr(w, http.StatusNotFound, "service not found")
			return
		}
		respondErr(w, http.StatusInternalServerError, "service lookup failed")
		return
	}

	var schema struct {
		Steps []formStep `json:"steps"`
	}
	_ = json.Unmarshal(schemaJSON, &schema)

	// 2. Counters (shared with the AI service-insights endpoint)
	fc := gatherFunnelCounts(h.db, serviceID)
	viewCount := fc.Views
	startedCount := fc.Started
	statusCounts := fc.StatusCounts
	completedByStep := fc.CompletedByStep

	// 3. Build funnel
	stages := []funnelStage{
		{Stage: "views", Label: "Просмотрели карточку", Count: viewCount},
		{Stage: "started", Label: "Начали подачу", Count: startedCount},
	}
	for i, st := range schema.Steps {
		stages = append(stages, funnelStage{
			Stage: st.ID + "_completed",
			Label: fmt.Sprintf("Шаг %d: %s", i+1, st.Title),
			Count: completedByStep[st.ID],
		})
	}
	submittedCount := statusCounts["submitted"] + statusCounts["in_review"] + statusCounts["approved"] + statusCounts["rejected"]
	approvedCount := statusCounts["approved"]
	stages = append(stages,
		funnelStage{Stage: "submitted", Label: "Подано", Count: submittedCount},
		funnelStage{Stage: "approved", Label: "Одобрено", Count: approvedCount},
	)

	// 4. Compute drop percentages
	for i := 1; i < len(stages); i++ {
		prev := stages[i-1].Count
		curr := stages[i].Count
		if prev > 0 {
			stages[i].DropPct = (prev - curr) * 100 / prev
			if stages[i].DropPct < 0 {
				stages[i].DropPct = 0
			}
		}
	}

	resp := funnelResponse{
		ServiceID:    serviceID,
		ServiceTitle: title,
		Funnel:       stages,
	}

	// 5. Biggest drop + drilldown.
	// Prefer drops between FORM STEPS (actionable for the institute) over
	// view→start drop (a marketing concern, not a form-design one).
	biggestIdx := 0
	biggestDropAbs := 0
	for i := 1; i < len(stages); i++ {
		// Only consider step_*_completed stages — these have field-level drilldown.
		if !strings.HasPrefix(stages[i].Stage, "step_") {
			continue
		}
		dropAbs := stages[i-1].Count - stages[i].Count
		if dropAbs > biggestDropAbs {
			biggestDropAbs = dropAbs
			biggestIdx = i
		}
	}
	if biggestIdx > 0 {
		stage := stages[biggestIdx]
		stagePrev := stages[biggestIdx-1]
		drilldownFields := h.drilldown(serviceID, stage.Stage, schema.Steps)
		resp.BiggestDrop = &biggestDrop{
			Stage:          stage.Stage,
			StageLabel:     stage.Label,
			AbandonedCount: stagePrev.Count - stage.Count,
			TopFields:      drilldownFields,
		}
	}

	respond(w, http.StatusOK, resp)
}

// drilldown inspects abandoned events on the step preceding (or at) `stage`
// and returns the top field(s) where users got stuck, with an insight string.
func (h *FunnelHandler) drilldown(serviceID, stage string, steps []formStep) []drilldownField {
	// Map stage name back to step_id
	stepID := ""
	stepIndex := -1
	for i, s := range steps {
		if s.ID+"_completed" == stage {
			stepID = s.ID
			stepIndex = i
			break
		}
	}
	if stepID == "" {
		// Stage like "submitted" / "approved" — no field-level drilldown
		return nil
	}

	// Most common abandoned field for this step
	type abandonedField struct {
		FieldID string `db:"last_field_id"`
		Count   int    `db:"count"`
	}
	rows := []abandonedField{}
	err := h.db.Select(&rows, `
		SELECT last_field_id, COUNT(*) AS count
		FROM application_events ev
		JOIN applications a ON a.id = ev.application_id
		WHERE a.service_id = $1
		  AND ev.step_id = $2
		  AND ev.event_type = 'abandoned'
		  AND ev.last_field_id IS NOT NULL
		GROUP BY last_field_id
		ORDER BY count DESC
		LIMIT 3`, serviceID, stepID)
	if err != nil || len(rows) == 0 {
		return nil
	}

	totalAbandoned := 0
	for _, r := range rows {
		totalAbandoned += r.Count
	}

	out := []drilldownField{}
	for _, r := range rows {
		fieldLabel := r.FieldID
		fieldType := ""
		// Find label/type in form schema
		if stepIndex >= 0 && stepIndex < len(steps) {
			for _, f := range steps[stepIndex].Fields {
				if f.ID == r.FieldID {
					fieldLabel = f.Label
					fieldType = f.Type
					break
				}
			}
		}

		stats, insight, audienceFix := h.fieldInsight(serviceID, stepID, r.FieldID, fieldType)

		pct := 0
		if totalAbandoned > 0 {
			pct = r.Count * 100 / totalAbandoned
		}
		out = append(out, drilldownField{
			FieldID:        r.FieldID,
			FieldLabel:     fieldLabel,
			AbandonedCount: r.Count,
			AbandonedPct:   pct,
			Stats:          stats,
			Insight:        insight,
			AudienceFix:    audienceFix,
		})
	}
	return out
}

// fieldInsight computes p25/median/p75 for numeric-looking abandoned values
// and crafts a deterministic insight phrase. AudienceFix is suggested filter
// for the audience drawer (e.g. cap revenue to fit program limit).
func (h *FunnelHandler) fieldInsight(serviceID, stepID, fieldID, fieldType string) (
	stats map[string]interface{}, insight string, audienceFix map[string]interface{},
) {
	stats = map[string]interface{}{"type": fieldType}

	// Try parsing values as bigint (currency/number fields)
	type stat struct {
		P25    sql.NullFloat64 `db:"p25"`
		Median sql.NullFloat64 `db:"median"`
		P75    sql.NullFloat64 `db:"p75"`
		MinVal sql.NullFloat64 `db:"min_val"`
		MaxVal sql.NullFloat64 `db:"max_val"`
		Cnt    int             `db:"cnt"`
	}
	var s stat
	err := h.db.Get(&s, `
		SELECT
		  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY (last_field_value)::numeric) AS p25,
		  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (last_field_value)::numeric) AS median,
		  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (last_field_value)::numeric) AS p75,
		  MIN((last_field_value)::numeric) AS min_val,
		  MAX((last_field_value)::numeric) AS max_val,
		  COUNT(*) AS cnt
		FROM application_events ev
		JOIN applications a ON a.id = ev.application_id
		WHERE a.service_id = $1
		  AND ev.step_id = $2
		  AND ev.last_field_id = $3
		  AND ev.event_type = 'abandoned'
		  AND ev.last_field_value ~ '^[0-9]+(\.[0-9]+)?$'`,
		serviceID, stepID, fieldID)

	if err == nil && s.Cnt >= 3 && s.Median.Valid {
		stats["median"] = s.Median.Float64
		stats["p25"] = s.P25.Float64
		stats["p75"] = s.P75.Float64
		stats["min"] = s.MinVal.Float64
		stats["max"] = s.MaxVal.Float64
		stats["sample_size"] = s.Cnt

		// Heuristic: if median is large enough, frame it as "limit too low"
		median := s.Median.Float64
		if median > 100_000_000 {
			// Round for display
			medianM := median / 1_000_000
			insight = fmt.Sprintf(
				"Медианное значение у тех кто бросил — %.0f млн ₸. Это выше типичного лимита программы. "+
					"Похоже, лимит ниже реальной потребности целевой аудитории.",
				medianM)
			// Suggest audience fix: cap min_revenue at ~2.5× program limit (= roughly the median)
			// so the calculator surfaces a more aligned audience.
			audienceFix = map[string]interface{}{
				"min_revenue": int64(median * 0.3),
				"max_revenue": int64(median * 1.5),
				"note":        "Подобрана аудитория, у которой выручка соответствует медианной потребности.",
			}
			return
		}
		insight = fmt.Sprintf(
			"Распределение значений у бросивших: p25 = %.0f, медиана = %.0f, p75 = %.0f. Стоит уточнить формулировку поля или диапазон допустимых значений.",
			s.P25.Float64, s.Median.Float64, s.P75.Float64)
		return
	}

	// Fallback insights by field type
	switch fieldType {
	case "file":
		insight = "Поле требует загрузки документа — возможно, заявителям сложно его собрать. Стоит уточнить требования или добавить шаблон."
	case "select", "radio":
		insight = "Поле с выбором — возможно, варианты не отражают реальные ситуации заявителей."
	case "checkbox":
		insight = "Чекбокс-согласие — возможно, заявители не готовы принять условие. Стоит проверить формулировку."
	default:
		insight = strings.TrimSpace(fmt.Sprintf("Большая часть отказов на этом поле. Рекомендуется проверить формулировку и валидацию."))
	}
	return
}
