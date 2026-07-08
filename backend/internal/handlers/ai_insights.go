package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

// ──────────────────────────────────────────────────────────────────────────────
// ServiceInsights: AI-инсайты для автора услуги. По накопленным данным (воронка,
// отказы, дозапросы, брошенные шаги, распределение prescore) Claude выдаёт
// конкретные рекомендации по улучшению формы/условий — «данные → что чинить →
// автор правит в конструкторе без релиза». Роут admin+author.
// POST /api/ai/service-insights  { service_id, refresh? }
// ──────────────────────────────────────────────────────────────────────────────

const insightsTTL = 10 * time.Minute

type insightsCacheEntry struct {
	version string
	at      time.Time
	result  map[string]interface{}
}

const insightsSystemPrompt = `Ты — продуктовый аналитик платформы господдержки бизнеса.
Тебе передан компактный аналитический срез по одной услуге: воронка (просмотры → начали →
подали → одобрено), количество отказов, тексты дозапросов документов, где заявители бросают
форму (шаги и поля), распределение предварительных грейдов (prescore band) и выжимка структуры
формы (шаги, поля, обязательность).

По этим данным дай автору услуги конкретные рекомендации, что улучшить в форме и условиях —
так, чтобы он мог поправить это прямо в no-code конструкторе (переформулировать поле, сделать
поле необязательным, разбить/объединить шаг, вынести документы на второй этап, уточнить лимиты
и т.п.).

Правила:
- Опирайся ТОЛЬКО на переданные цифры. НЕ выдумывай значения, которых нет во входе.
- В поле finding приводи конкретные наблюдения с числами из данных.
- В recommendation — что именно сделать в конструкторе (действие, а не общие слова).
- target указывай, только если рекомендация привязана к конкретному шагу (step_id) или полю
  (field_id) из выжимки формы; иначе опусти.
- severity: critical — серьёзная проблема, теряется много заявок; warning — заметный риск;
  info — наблюдение/точечное улучшение.
- Максимум 6 инсайтов, только обоснованные данными. Лучше меньше, но по делу.
- health_score (0–100) — общая оценка здоровья услуги по конверсии и качеству потока.

Верни ТОЛЬКО валидный JSON без markdown и пояснений:
{
  "health_score": 72,
  "summary": "2-3 предложения общей картины",
  "insights": [
    {
      "severity": "critical|warning|info",
      "finding": "что видно в данных, с цифрами",
      "recommendation": "что конкретно сделать в конструкторе",
      "target": "step_id или field_id (опционально)"
    }
  ]
}`

// schema outline structs — token-cheap form structure для промпта и разрешения target.
type insightsFieldOutline struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Required bool   `json:"required,omitempty"`
}

type insightsStepOutline struct {
	ID     string                 `json:"id"`
	Title  string                 `json:"title"`
	Stage  int                    `json:"stage,omitempty"`
	Fields []insightsFieldOutline `json:"fields"`
}

// outlineSchema builds a compact per-step/field outline (id, label, type, required)
// plus a lookup of step_id/field_id → human label (for the funnel drop context).
func outlineSchema(fs models.JSONB) (steps []insightsStepOutline, stepTitle, fieldLabel map[string]string) {
	stepTitle = map[string]string{}
	fieldLabel = map[string]string{}
	rawSteps, ok := fs["steps"].([]interface{})
	if !ok {
		return
	}
	for _, rs := range rawSteps {
		step, ok := rs.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := step["id"].(string)
		title, _ := step["title"].(string)
		out := insightsStepOutline{ID: id, Title: title}
		if stg, ok := step["stage"].(float64); ok {
			out.Stage = int(stg)
		}
		if id != "" {
			stepTitle[id] = title
		}
		fields, _ := step["fields"].([]interface{})
		for _, rf := range fields {
			field, ok := rf.(map[string]interface{})
			if !ok {
				continue
			}
			fid, _ := field["id"].(string)
			label, _ := field["label"].(string)
			ftype, _ := field["type"].(string)
			req, _ := field["required"].(bool)
			out.Fields = append(out.Fields, insightsFieldOutline{ID: fid, Label: label, Type: ftype, Required: req})
			if fid != "" {
				fieldLabel[fid] = label
			}
		}
		steps = append(steps, out)
	}
	return
}

func truncate(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	// len is byte-based; trim on rune boundary for safety.
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return strings.TrimSpace(string(r[:n])) + "…"
}

func (h *AIHandler) ServiceInsights(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ServiceID string `json:"service_id"`
		Refresh   bool   `json:"refresh"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.ServiceID) == "" {
		respondErr(w, http.StatusBadRequest, "service_id required")
		return
	}

	// Service + schema.
	type svc struct {
		ID         string       `db:"id"`
		Title      string       `db:"title"`
		FormSchema models.JSONB `db:"form_schema"`
	}
	var s svc
	if err := h.db.Get(&s,
		`SELECT id, title, form_schema FROM services WHERE id = $1`, req.ServiceID); err != nil {
		respondErr(w, http.StatusNotFound, "service not found")
		return
	}

	// Lifecycle aggregates (shared with the funnel endpoint).
	fc := gatherFunnelCounts(h.db, req.ServiceID)

	// No-data short-circuit: skip Anthropic entirely to save tokens/time.
	if fc.Started == 0 && fc.Views == 0 {
		respond(w, http.StatusOK, map[string]interface{}{
			"health_score": nil,
			"summary":      "Недостаточно данных для анализа: по услуге пока нет просмотров и заявок. Инсайты появятся, когда заявители начнут открывать карточку и подавать заявки.",
			"insights":     []interface{}{},
		})
		return
	}

	// Cache: version derived from data volume; refresh forces recompute.
	rejectedCount := fc.StatusCounts["rejected"]
	docsReqCount := fc.StatusCounts["docs_requested"]
	version := fmt.Sprintf("v%d.%d.%d.%d.%d",
		fc.Views, fc.Started, fc.StatusCounts["approved"], rejectedCount, docsReqCount)
	if !req.Refresh {
		h.insightsMu.RLock()
		cached, hit := h.insightsCache[s.ID]
		h.insightsMu.RUnlock()
		if hit && cached.version == version && time.Since(cached.at) < insightsTTL {
			respond(w, http.StatusOK, cached.result)
			return
		}
	}

	// Build compact analytical context.
	steps, stepTitle, fieldLabel := outlineSchema(s.FormSchema)

	submittedCount := fc.StatusCounts["submitted"] + fc.StatusCounts["in_review"] +
		fc.StatusCounts["docs_requested"] + fc.StatusCounts["approved"] + fc.StatusCounts["rejected"]

	funnelCtx := map[string]interface{}{
		"views":     fc.Views,
		"started":   fc.Started,
		"submitted": submittedCount,
		"approved":  fc.StatusCounts["approved"],
	}
	statusCtx := map[string]interface{}{
		"draft":          fc.StatusCounts["draft"],
		"submitted":      fc.StatusCounts["submitted"],
		"in_review":      fc.StatusCounts["in_review"],
		"docs_requested": docsReqCount,
		"approved":       fc.StatusCounts["approved"],
		"rejected":       rejectedCount,
	}

	// docs_requested texts (why staff had to ask applicants for more) — up to 30, trimmed.
	docsMessages := []string{}
	_ = h.db.Select(&docsMessages, `
		SELECT request_message FROM applications
		WHERE service_id = $1 AND status = 'docs_requested'
		  AND COALESCE(request_message, '') <> ''
		ORDER BY updated_at DESC
		LIMIT 30`, req.ServiceID)
	for i := range docsMessages {
		docsMessages[i] = truncate(docsMessages[i], 220)
	}

	// Where applicants abandon the form — completed counts per step + abandoned by field.
	stepFunnel := make([]map[string]interface{}, 0, len(steps))
	for _, st := range steps {
		stepFunnel = append(stepFunnel, map[string]interface{}{
			"step_id":   st.ID,
			"title":     st.Title,
			"completed": fc.CompletedByStep[st.ID],
			"fields_n":  len(st.Fields),
		})
	}

	type abandonedRow struct {
		StepID  string `db:"step_id"`
		FieldID string `db:"last_field_id"`
		Count   int    `db:"count"`
	}
	abRows := []abandonedRow{}
	_ = h.db.Select(&abRows, `
		SELECT ev.step_id, ev.last_field_id, COUNT(*) AS count
		FROM application_events ev
		JOIN applications a ON a.id = ev.application_id
		WHERE a.service_id = $1 AND ev.event_type = 'abandoned'
		  AND ev.last_field_id IS NOT NULL
		GROUP BY ev.step_id, ev.last_field_id
		ORDER BY count DESC
		LIMIT 8`, req.ServiceID)
	abandonedByField := make([]map[string]interface{}, 0, len(abRows))
	for _, ar := range abRows {
		abandonedByField = append(abandonedByField, map[string]interface{}{
			"step_id":     ar.StepID,
			"step_title":  stepTitle[ar.StepID],
			"field_id":    ar.FieldID,
			"field_label": fieldLabel[ar.FieldID],
			"count":       ar.Count,
		})
	}

	// Drafts: how many are stuck, and how they distribute across steps (via last event).
	draftCount := fc.StatusCounts["draft"]
	type draftStepRow struct {
		StepID string `db:"step_id"`
		Count  int    `db:"count"`
	}
	draftStepRows := []draftStepRow{}
	_ = h.db.Select(&draftStepRows, `
		SELECT last.step_id, COUNT(*) AS count
		FROM (
			SELECT DISTINCT ON (ev.application_id) ev.application_id, ev.step_id
			FROM application_events ev
			JOIN applications a ON a.id = ev.application_id
			WHERE a.service_id = $1 AND a.status = 'draft'
			ORDER BY ev.application_id, ev.created_at DESC
		) last
		GROUP BY last.step_id
		ORDER BY count DESC`, req.ServiceID)
	draftsByStep := make([]map[string]interface{}, 0, len(draftStepRows))
	for _, d := range draftStepRows {
		draftsByStep = append(draftsByStep, map[string]interface{}{
			"step_id":    d.StepID,
			"step_title": stepTitle[d.StepID],
			"count":      d.Count,
		})
	}

	// Prescore band distribution (non-draft applications that carry a _prescore).
	type bandRow struct {
		Band  string `db:"band"`
		Count int    `db:"count"`
	}
	bandRows := []bandRow{}
	_ = h.db.Select(&bandRows, `
		SELECT COALESCE(form_data->'_prescore'->>'band', 'none') AS band, COUNT(*) AS count
		FROM applications
		WHERE service_id = $1 AND status != 'draft'
		GROUP BY band
		ORDER BY band`, req.ServiceID)
	sort.Slice(bandRows, func(i, j int) bool { return bandRows[i].Band < bandRows[j].Band })
	prescoreDist := make(map[string]int, len(bandRows))
	for _, b := range bandRows {
		prescoreDist[b.Band] = b.Count
	}

	userPayload := map[string]interface{}{
		"service_title":         s.Title,
		"funnel":                funnelCtx,
		"status_breakdown":      statusCtx,
		"rejected_count":        rejectedCount,
		"docs_requested_count":  docsReqCount,
		"docs_requested_texts":  docsMessages,
		"steps_funnel":          stepFunnel,
		"abandoned_by_field":    abandonedByField,
		"drafts_count":          draftCount,
		"drafts_stuck_by_step":  draftsByStep,
		"prescore_distribution": prescoreDist,
		"form_outline":          steps,
	}
	userContentBytes, _ := json.Marshal(userPayload)
	userContent := string(userContentBytes)

	var parsed struct {
		HealthScore *int   `json:"health_score"`
		Summary     string `json:"summary"`
		Insights    []struct {
			Severity       string `json:"severity"`
			Finding        string `json:"finding"`
			Recommendation string `json:"recommendation"`
			Target         string `json:"target,omitempty"`
		} `json:"insights"`
	}
	if err := h.callClaudeJSON(r.Context(), insightsSystemPrompt, userContent, 2000, &parsed); err != nil {
		respondErr(w, http.StatusBadGateway, err.Error())
		return
	}

	// Validate & normalize.
	if parsed.HealthScore != nil {
		v := *parsed.HealthScore
		if v < 0 {
			v = 0
		}
		if v > 100 {
			v = 100
		}
		parsed.HealthScore = &v
	}
	insights := make([]map[string]interface{}, 0, len(parsed.Insights))
	for _, in := range parsed.Insights {
		sev := in.Severity
		if sev != "critical" && sev != "warning" && sev != "info" {
			sev = "info"
		}
		if strings.TrimSpace(in.Finding) == "" && strings.TrimSpace(in.Recommendation) == "" {
			continue
		}
		item := map[string]interface{}{
			"severity":       sev,
			"finding":        in.Finding,
			"recommendation": in.Recommendation,
		}
		if strings.TrimSpace(in.Target) != "" {
			item["target"] = in.Target
		}
		insights = append(insights, item)
		if len(insights) >= 6 {
			break
		}
	}

	result := map[string]interface{}{
		"health_score": parsed.HealthScore,
		"summary":      parsed.Summary,
		"insights":     insights,
	}

	h.insightsMu.Lock()
	h.insightsCache[s.ID] = insightsCacheEntry{version: version, at: time.Now(), result: result}
	h.insightsMu.Unlock()

	respond(w, http.StatusOK, result)
}
