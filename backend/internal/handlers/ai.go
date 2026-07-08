package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type AIHandler struct {
	apiKey string
	db     *sqlx.DB
}

func NewAIHandler(apiKey string, db *sqlx.DB) *AIHandler {
	return &AIHandler{apiKey: apiKey, db: db}
}

const systemPrompt = `Ты — конструктор форм для казахстанских государственных услуг.
На основе описания услуги сгенерируй и метаданные программы, и form_schema в JSON формате.
Верни ТОЛЬКО валидный JSON без markdown блоков, без пояснений.

Формат ответа:
{
  "service_meta": {
    "title": "Краткое название программы (5–10 слов, например: «Лизинг авиатранспорта и вагонов»)",
    "description": "2–3 предложения о программе для каталога — что финансируем, кому, на каких условиях",
    "category": "одно значение из: Финансирование | Гарантии | Лизинг | Экспорт | Инвестиции | Гранты | Субсидии | Агросектор | Страхование",
    "org_name": "одно значение из: АО «НИХ «Байтерек» | Даму | Аграрная кредитная корпорация | КазАгроФинанс | Фонд развития промышленности | ЭКА KazakhExport | Kazakh Invest | Astana Hub | QazIndustry | Центры занятости (enbek.kz)",
    "interest_rate": "процентная ставка как число (например, \"6.0\" или \"9.5\"); пусто или опусти если не применимо (например, грант)",
    "max_amount": "максимальная сумма в тенге как целое число без пробелов (например, \"500000000\" для 500 млн); опусти если не применимо",
    "max_term_months": "максимальный срок в месяцах как целое число (например, \"84\" для 7 лет); опусти если не применимо"
  },
  "steps": [
    {
      "id": "step_1",
      "title": "Название шага",
      "stage": 1,
      "fields": [
        {
          "id": "field_1",
          "type": "text|textarea|number|select|multiselect|date|file|calculated|checkbox|radio",
          "label": "Название поля",
          "placeholder": "Подсказка (опционально)",
          "required": true,
          "options": ["Опция 1", "Опция 2"],
          "mask": "currency|percent",
          "formula": "field_X * field_Y",
          "readonly": false,
          "accept": ".pdf,.xlsx",
          "prefill_from": "egov.field_name"
        }
      ],
      "condition": {
        "field_id": "field_X",
        "operator": "equals|not_equals|greater_than|less_than",
        "value": "значение"
      }
    }
  ]
}

Правила:
- service_meta.category и service_meta.org_name — СТРОГО из указанных списков. Если ни одно не подходит — выбери ближайшее по смыслу. Не придумывай новых значений.
- service_meta.title должен быть коротким (для карточки в каталоге), без слов «программа», «мера поддержки» — только суть.
- Числовые поля meta (interest_rate, max_amount, max_term_months) — строкой, чтобы их можно было вставить в input.
- Для грантов interest_rate опускай, оставь только max_amount.
- type "calculated" использует formula (JS выражение с id полей)
- type "file" использует accept для разрешённых форматов
- condition на step делает шаг условным
- prefill_from используй для полей БИН/ИИН и названия организации (egov.iin, egov.org_name)
- Всегда начинай с шага информации о заявителе/компании
- НИКОГДА не используй null. Если значение опционально и не нужно — просто опусти ключ.
  Запрещено: "mask": null, "options": null, "formula": null, "condition": null, "accept": null, "placeholder": null и т.п.
- mask допускает ТОЛЬКО "currency" или "percent" (для денежных и процентных полей). Для текстовых полей ключ mask опускай.
- operator в condition допускает ТОЛЬКО: equals, not_equals, greater_than, less_than.
- stage — номер этапа подачи у шага. Шаги первичной подачи — stage 1 (или без поля).
  Шаги дозаполнения после предварительного одобрения (загрузка документов, расширенные
  данные) — stage 2. Если услуга предполагает двухэтапную подачу (сначала первичная
  заявка, затем по запросу администратора — документы) — вынеси документы в шаги со stage 2.
`

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	System    string          `json:"system"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (h *AIHandler) GenerateForm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Description string `json:"description"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.Description) == "" {
		respondErr(w, http.StatusBadRequest, "description required")
		return
	}

	payload := claudeRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 8192,
		System:    systemPrompt,
		Messages:  []claudeMessage{{Role: "user", Content: req.Description}},
	}

	body, _ := json.Marshal(payload)
	httpReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", h.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		respondErr(w, http.StatusBadGateway, "claude api unreachable")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var claudeResp claudeResponse
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to parse claude response")
		return
	}
	if claudeResp.Error != nil {
		respondErr(w, http.StatusBadGateway, fmt.Sprintf("claude error: %s", claudeResp.Error.Message))
		return
	}
	if len(claudeResp.Content) == 0 {
		respondErr(w, http.StatusInternalServerError, "empty response from claude")
		return
	}

	rawJSON := strings.TrimSpace(claudeResp.Content[0].Text)
	// Strip accidental markdown fences
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var schema map[string]interface{}
	if err := json.Unmarshal([]byte(rawJSON), &schema); err != nil {
		respondErr(w, http.StatusInternalServerError, "claude returned invalid JSON")
		return
	}

	respond(w, http.StatusOK, map[string]interface{}{"form_schema": schema})
}

func (h *AIHandler) GenerateFormStream(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Description string `json:"description"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.Description) == "" {
		respondErr(w, http.StatusBadRequest, "description required")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	type streamPayload struct {
		Model     string          `json:"model"`
		MaxTokens int             `json:"max_tokens"`
		System    string          `json:"system"`
		Messages  []claudeMessage `json:"messages"`
		Stream    bool            `json:"stream"`
	}

	payload := streamPayload{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 8192,
		System:    systemPrompt,
		Messages:  []claudeMessage{{Role: "user", Content: req.Description}},
		Stream:    true,
	}

	body, _ := json.Marshal(payload)
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\":\"request build failed\"}\n\n")
		flusher.Flush()
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", h.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		fmt.Fprintf(w, "data: {\"error\":\"claude api unreachable\"}\n\n")
		flusher.Flush()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		errMsg, _ := json.Marshal(string(errBody))
		fmt.Fprintf(w, "data: {\"error\":%s}\n\n", errMsg)
		flusher.Flush()
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 512*1024), 512*1024)

	for scanner.Scan() {
		select {
		case <-r.Context().Done():
			return
		default:
		}

		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		var event struct {
			Type  string `json:"type"`
			Delta *struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta != nil && event.Delta.Type == "text_delta" {
				chunk, _ := json.Marshal(map[string]string{"t": event.Delta.Text})
				fmt.Fprintf(w, "data: %s\n\n", chunk)
				flusher.Flush()
			}
		case "message_stop":
			fmt.Fprintf(w, "data: {\"done\":true}\n\n")
			flusher.Flush()
			return
		case "error":
			if event.Error != nil {
				errMsg, _ := json.Marshal(event.Error.Message)
				fmt.Fprintf(w, "data: {\"error\":%s}\n\n", errMsg)
				flusher.Flush()
			}
			return
		}
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Recommend: подбирает 2-3 альтернативные услуги под профиль заявителя.
// Используется (а) при отказе по текущей заявке, (б) перед подачей если есть
// блокирующие риски, (в) в публичном онбординге.
// ──────────────────────────────────────────────────────────────────────────────

const recommendSystemPrompt = `Ты — консультант по мерам государственной поддержки бизнеса Казахстана.
На входе: профиль заявителя (eGov + налоговая история КГД), опционально текущая услуга и причина отказа.
Тебе передан список доступных услуг с правилами eligibility.

Задача: выбрать 2-3 АЛЬТЕРНАТИВНЫЕ услуги, которые с высокой вероятностью подойдут этому заявителю,
и кратко объяснить почему (1-2 предложения, конкретно — со ссылкой на цифры из профиля КГД).

Правила:
- Не повторяй услугу, которая уже не подошла (если передан exclude_service_id).
- Учитывай: выручку, возраст бизнеса, налоговую задолженность, реестр риска, отрасль (ОКЭД), численность.
- Если по выручке заявитель — крупный, не предлагай ему программы для МСБ.
- Если возраст бизнеса < 12 месяцев, не предлагай программы с требованием опыта.
- Если задолженность или реестр риска — сначала укажи это и предложи безвозмездные/мягкие инструменты.
- Если ничего не подходит — верни пустой массив recommendations и заполни note.

Верни ТОЛЬКО валидный JSON без markdown и пояснений:
{
  "recommendations": [
    {
      "service_id": "uuid",
      "title": "название услуги",
      "org_name": "Даму",
      "reason": "Почему именно эта услуга — конкретно, со ссылкой на профиль (1-2 предложения)"
    }
  ],
  "note": "Общий комментарий — что в первую очередь стоит сделать заявителю (опционально, 1 предложение)"
}`

type recommendRequest struct {
	KGD              map[string]interface{} `json:"kgd"`
	EGov             map[string]interface{} `json:"egov"`
	ExcludeServiceID string                 `json:"exclude_service_id,omitempty"`
	RejectionReason  string                 `json:"rejection_reason,omitempty"`
	ScreenerAnswers  map[string]interface{} `json:"screener_answers,omitempty"`
}

func (h *AIHandler) Recommend(w http.ResponseWriter, r *http.Request) {
	var req recommendRequest
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid request")
		return
	}

	// Fetch published services (lean: omit form_schema to save tokens)
	type leanService struct {
		ID               string       `db:"id"`
		Title            string       `db:"title"`
		Description      *string      `db:"description"`
		Category         *string      `db:"category"`
		OrgName          *string      `db:"org_name"`
		EligibilityRules models.JSONB `db:"eligibility_rules"`
	}
	var services []leanService
	err := h.db.Select(&services,
		`SELECT id, title, description, category, org_name, eligibility_rules
		 FROM services WHERE status = 'published' ORDER BY created_at DESC`)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch services")
		return
	}

	if req.ExcludeServiceID != "" {
		filtered := services[:0]
		for _, s := range services {
			if s.ID != req.ExcludeServiceID {
				filtered = append(filtered, s)
			}
		}
		services = filtered
	}

	if len(services) == 0 {
		respond(w, http.StatusOK, map[string]interface{}{
			"recommendations": []interface{}{},
			"note":            "В каталоге пока нет других услуг",
		})
		return
	}

	userPayload := map[string]interface{}{
		"profile":           map[string]interface{}{"egov": req.EGov, "kgd": req.KGD},
		"available_services": services,
	}
	if req.ExcludeServiceID != "" {
		userPayload["exclude_service_id"] = req.ExcludeServiceID
	}
	if req.RejectionReason != "" {
		userPayload["rejection_reason"] = req.RejectionReason
	}
	if req.ScreenerAnswers != nil {
		userPayload["screener_answers"] = req.ScreenerAnswers
	}
	userContent, _ := json.Marshal(userPayload)

	payload := claudeRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 1024,
		System:    recommendSystemPrompt,
		Messages:  []claudeMessage{{Role: "user", Content: string(userContent)}},
	}

	body, _ := json.Marshal(payload)
	httpReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		"https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", h.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		respondErr(w, http.StatusBadGateway, "claude api unreachable")
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var claudeResp claudeResponse
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to parse claude response")
		return
	}
	if claudeResp.Error != nil {
		respondErr(w, http.StatusBadGateway, fmt.Sprintf("claude error: %s", claudeResp.Error.Message))
		return
	}
	if len(claudeResp.Content) == 0 {
		respondErr(w, http.StatusInternalServerError, "empty response from claude")
		return
	}

	rawJSON := strings.TrimSpace(claudeResp.Content[0].Text)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
		respondErr(w, http.StatusInternalServerError, "claude returned invalid JSON")
		return
	}

	respond(w, http.StatusOK, result)
}
