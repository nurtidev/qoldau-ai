package handlers

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

const (
	anthropicURL     = "https://api.anthropic.com/v1/messages"
	anthropicModel   = "claude-sonnet-4-6"
	anthropicVersion = "2023-06-01"
)

// Shared HTTP client for AI calls with a sane timeout (task: 60s).
var aiHTTPClient = &http.Client{Timeout: 60 * time.Second}

type explainCacheEntry struct {
	version string // sha256 содержимого услуги — инвалидируется при любой правке
	text    string
}

type AIHandler struct {
	apiKey string
	db     *sqlx.DB

	// In-memory cache of "explain in plain words" results, keyed by service_id.
	// Repeated card opens are instant and cost no tokens.
	explainMu    sync.RWMutex
	explainCache map[string]explainCacheEntry

	// In-memory cache of AI service-insights, keyed by service_id. Versioned by
	// the application/view counts (data changes ⇒ new version) with a short TTL.
	insightsMu    sync.RWMutex
	insightsCache map[string]insightsCacheEntry
}

func NewAIHandler(apiKey string, db *sqlx.DB) *AIHandler {
	return &AIHandler{
		apiKey:        apiKey,
		db:            db,
		explainCache:  make(map[string]explainCacheEntry),
		insightsCache: make(map[string]insightsCacheEntry),
	}
}

// ── Shared Anthropic helpers ────────────────────────────────────────────────

// stripJSONFences removes accidental ```json ... ``` markdown wrappers.
func stripJSONFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// callClaudeText performs a non-streaming Anthropic call and returns the text.
func (h *AIHandler) callClaudeText(ctx context.Context, system, userContent string, maxTokens int) (string, error) {
	payload := claudeRequest{
		Model:     anthropicModel,
		MaxTokens: maxTokens,
		System:    system,
		Messages:  []claudeMessage{{Role: "user", Content: userContent}},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("request build failed")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", h.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := aiHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("claude api unreachable")
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var cr claudeResponse
	if err := json.Unmarshal(respBody, &cr); err != nil {
		return "", fmt.Errorf("failed to parse claude response")
	}
	if cr.Error != nil {
		return "", fmt.Errorf("claude error: %s", cr.Error.Message)
	}
	if len(cr.Content) == 0 {
		return "", fmt.Errorf("empty response from claude")
	}
	return cr.Content[0].Text, nil
}

// callClaudeJSON calls Claude and unmarshals the (fence-stripped) response into out.
func (h *AIHandler) callClaudeJSON(ctx context.Context, system, userContent string, maxTokens int, out interface{}) error {
	text, err := h.callClaudeText(ctx, system, userContent, maxTokens)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(stripJSONFences(text)), out); err != nil {
		return fmt.Errorf("claude returned invalid JSON")
	}
	return nil
}

// summarizeSchema extracts a lean, token-cheap outline of a form_schema:
// step titles, file fields (as "documents to prepare") and calculated fields.
func summarizeSchema(fs models.JSONB) (steps, documents, calculated []string) {
	rawSteps, ok := fs["steps"].([]interface{})
	if !ok {
		return
	}
	for _, rs := range rawSteps {
		step, ok := rs.(map[string]interface{})
		if !ok {
			continue
		}
		if title, ok := step["title"].(string); ok && title != "" {
			steps = append(steps, title)
		}
		fields, ok := step["fields"].([]interface{})
		if !ok {
			continue
		}
		for _, rf := range fields {
			field, ok := rf.(map[string]interface{})
			if !ok {
				continue
			}
			label, _ := field["label"].(string)
			if label == "" {
				continue
			}
			switch field["type"] {
			case "file":
				if accept, ok := field["accept"].(string); ok && accept != "" {
					documents = append(documents, fmt.Sprintf("%s (%s)", label, accept))
				} else {
					documents = append(documents, label)
				}
			case "calculated":
				calculated = append(calculated, label)
			}
		}
	}
	return
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
		"profile":            map[string]interface{}{"egov": req.EGov, "kgd": req.KGD},
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

// ──────────────────────────────────────────────────────────────────────────────
// ExplainService: объясняет условия услуги простым языком (SSE-стриминг + кэш).
// Публичный роут — жюри смотрит карточки до логина.
// ──────────────────────────────────────────────────────────────────────────────

const explainSystemPrompt = `Ты — консультант портала господдержки бизнеса Казахстана.
Тебе передан JSON с описанием одной меры поддержки. Объясни её предпринимателю
простым, живым языком — без канцелярита, без юридических штампов.

Строго на русском. Ответ — короткий Markdown (заголовки уровня ## и ###, списки "- ",
выделение **жирным**). Не более ~350 слов. Структура:

## Что это
1–2 предложения: что за мера поддержки и зачем.

## Кому подходит
Маркированный список: кому эта программа. И отдельно — **кто НЕ пройдёт** (стоп-факторы),
если это видно из правил eligibility.

## Что вы получите
Конкретика: суммы, ставки, сроки (бери из terms и описания). Если данных нет — так и скажи.

## Какие документы готовить
Список из переданных документов (documents). Если пусто — «уточняется».

## Как проходит
Короткие этапы (из steps): по шагам, что делать заявителю.

## На что обратить внимание
1–2 практических совета/предостережения.

Не выдумывай цифры, которых нет во входных данных. Пиши по делу.`

func (h *AIHandler) ExplainService(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ServiceID string `json:"service_id"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.ServiceID) == "" {
		respondErr(w, http.StatusBadRequest, "service_id required")
		return
	}

	type svc struct {
		ID               string       `db:"id"`
		Title            string       `db:"title"`
		Description      *string      `db:"description"`
		Category         *string      `db:"category"`
		OrgName          *string      `db:"org_name"`
		CreatedAt        time.Time    `db:"created_at"`
		FormSchema       models.JSONB `db:"form_schema"`
		EligibilityRules models.JSONB `db:"eligibility_rules"`
		InterestRate     *float64     `db:"interest_rate"`
		MaxAmount        *int64       `db:"max_amount"`
		MaxTermMonths    *int         `db:"max_term_months"`
	}
	var s svc
	err := h.db.Get(&s,
		`SELECT id, title, description, category, org_name, created_at,
		        form_schema, eligibility_rules, interest_rate, max_amount, max_term_months
		 FROM services WHERE id = $1`, req.ServiceID)
	if err != nil {
		respondErr(w, http.StatusNotFound, "service not found")
		return
	}

	// SSE headers.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Версия кэша — хэш содержимого услуги: у services нет updated_at, а PUT из
	// конструктора не меняет created_at, иначе после правки услуги отдавался бы
	// устаревший текст до рестарта сервера.
	rawSvc, _ := json.Marshal(s)
	sum := sha256.Sum256(rawSvc)
	version := hex.EncodeToString(sum[:])

	// Cache hit — emit whole text in one chunk, instantly, no tokens spent.
	h.explainMu.RLock()
	cached, hit := h.explainCache[s.ID]
	h.explainMu.RUnlock()
	if hit && cached.version == version {
		chunk, _ := json.Marshal(map[string]string{"t": cached.text})
		fmt.Fprintf(w, "data: %s\n\n", chunk)
		fmt.Fprintf(w, "data: {\"done\":true}\n\n")
		flusher.Flush()
		return
	}

	steps, documents, calculated := summarizeSchema(s.FormSchema)
	userPayload := map[string]interface{}{
		"name":        s.Title,
		"description": s.Description,
		"category":    s.Category,
		"org_name":    s.OrgName,
		"terms": map[string]interface{}{
			"interest_rate":   s.InterestRate,
			"max_amount":      s.MaxAmount,
			"max_term_months": s.MaxTermMonths,
		},
		"steps":             steps,
		"documents":         documents,
		"calculated":        calculated,
		"eligibility_rules": s.EligibilityRules,
	}
	userContent, _ := json.Marshal(userPayload)

	full, err := h.streamClaude(r.Context(), explainSystemPrompt, string(userContent), 1500, func(delta string) {
		chunk, _ := json.Marshal(map[string]string{"t": delta})
		fmt.Fprintf(w, "data: %s\n\n", chunk)
		flusher.Flush()
	})
	if err != nil {
		errMsg, _ := json.Marshal(err.Error())
		fmt.Fprintf(w, "data: {\"error\":%s}\n\n", errMsg)
		flusher.Flush()
		return
	}

	if strings.TrimSpace(full) != "" {
		h.explainMu.Lock()
		h.explainCache[s.ID] = explainCacheEntry{version: version, text: full}
		h.explainMu.Unlock()
	}

	fmt.Fprintf(w, "data: {\"done\":true}\n\n")
	flusher.Flush()
}

// streamClaude opens an Anthropic SSE stream, invokes onDelta for each text chunk,
// and returns the accumulated full text. Respects ctx cancellation.
func (h *AIHandler) streamClaude(ctx context.Context, system, userContent string, maxTokens int, onDelta func(string)) (string, error) {
	type streamPayload struct {
		Model     string          `json:"model"`
		MaxTokens int             `json:"max_tokens"`
		System    string          `json:"system"`
		Messages  []claudeMessage `json:"messages"`
		Stream    bool            `json:"stream"`
	}
	payload := streamPayload{
		Model:     anthropicModel,
		MaxTokens: maxTokens,
		System:    system,
		Messages:  []claudeMessage{{Role: "user", Content: userContent}},
		Stream:    true,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("request build failed")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", h.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := aiHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("claude api unreachable")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("claude error: %s", strings.TrimSpace(string(errBody)))
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 512*1024), 512*1024)

	var full strings.Builder
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return full.String(), ctx.Err()
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
				full.WriteString(event.Delta.Text)
				onDelta(event.Delta.Text)
			}
		case "message_stop":
			return full.String(), nil
		case "error":
			if event.Error != nil {
				return full.String(), fmt.Errorf("%s", event.Error.Message)
			}
			return full.String(), fmt.Errorf("stream error")
		}
	}
	if err := scanner.Err(); err != nil {
		return full.String(), err
	}
	return full.String(), nil
}

// ──────────────────────────────────────────────────────────────────────────────
// PickService: AI-подбор услуг по ответам скринера на главной. Публичный.
// ──────────────────────────────────────────────────────────────────────────────

const pickSystemPrompt = `Ты — консультант по мерам господдержки бизнеса Казахстана.
На входе: ответы предпринимателя из короткого опросника (цель, отрасль, возраст бизнеса,
годовая выручка) и список опубликованных услуг с правилами eligibility.

Выбери ТОП-3 наиболее подходящих услуги под этот профиль. Только из переданного списка,
service_id должны существовать. Для каждой — насколько подходит (0-100) и краткое объяснение
почему именно этому профилю, и при необходимости — на что обратить внимание.

Учитывай: если выбрана цель «грант» — приоритет грантам; «гарантия» — гарантийным программам;
«кредит/лизинг» — финансированию/лизингу; «субсидия» — субсидиям/льготным ставкам.
Отрасль и возраст бизнеса влияют на релевантность. Не предлагай явно неподходящее.

Верни ТОЛЬКО валидный JSON без markdown и пояснений:
{
  "recommendations": [
    {
      "service_id": "uuid из списка",
      "match": 85,
      "reason": "Краткое объяснение почему подходит именно этому профилю (1-2 предложения)",
      "caution": "На что обратить внимание (опционально, 1 предложение)"
    }
  ]
}`

func (h *AIHandler) PickService(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Answers map[string]interface{} `json:"answers"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid request")
		return
	}

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
	if len(services) == 0 {
		respond(w, http.StatusOK, map[string]interface{}{"recommendations": []interface{}{}})
		return
	}

	validIDs := make(map[string]bool, len(services))
	for _, s := range services {
		validIDs[s.ID] = true
	}

	userContent, _ := json.Marshal(map[string]interface{}{
		"answers":            req.Answers,
		"available_services": services,
	})

	var parsed struct {
		Recommendations []struct {
			ServiceID string `json:"service_id"`
			Match     int    `json:"match"`
			Reason    string `json:"reason"`
			Caution   string `json:"caution,omitempty"`
		} `json:"recommendations"`
	}
	if err := h.callClaudeJSON(r.Context(), pickSystemPrompt, string(userContent), 1024, &parsed); err != nil {
		respondErr(w, http.StatusBadGateway, err.Error())
		return
	}

	// Validate: keep only existing service_id, cap at 3.
	out := make([]map[string]interface{}, 0, 3)
	for _, rec := range parsed.Recommendations {
		if !validIDs[rec.ServiceID] {
			continue
		}
		item := map[string]interface{}{
			"service_id": rec.ServiceID,
			"match":      rec.Match,
			"reason":     rec.Reason,
		}
		if strings.TrimSpace(rec.Caution) != "" {
			item["caution"] = rec.Caution
		}
		out = append(out, item)
		if len(out) >= 3 {
			break
		}
	}

	respond(w, http.StatusOK, map[string]interface{}{"recommendations": out})
}

// ──────────────────────────────────────────────────────────────────────────────
// ReviewApplication: AI-проверка заявки перед отправкой. Требует auth.
// ──────────────────────────────────────────────────────────────────────────────

const reviewSystemPrompt = `Ты — помощник, который проверяет заявку предпринимателя ПЕРЕД отправкой
на меру господдержки. Тебе передана схема формы (шаги, поля, лейблы, required, условия) и
введённые заявителем данные. Для полей-файлов передаётся только факт заполнения, не содержимое.

Найди проблемы, которые стоит поправить до отправки:
- незаполненные важные (required) поля;
- противоречия между полями (например: сумма аванса больше суммы лизинга; срок вне допустимого;
  выручка не соответствует заявленной категории/масштабу бизнеса);
- подозрительные/нереалистичные значения;
- несоответствие критериям услуги (eligibility).

Не придирайся к мелочам и не выдумывай проблемы, которых нет. Если всё в порядке — так и скажи.

Верни ТОЛЬКО валидный JSON без markdown и пояснений:
{
  "verdict": "ok" | "issues",
  "summary": "1-2 предложения — общий вывод для заявителя",
  "issues": [
    {
      "field_id": "id поля из схемы (или пусто, если проблема общая)",
      "label": "человеко-понятный лейбл поля",
      "severity": "error" | "warning",
      "message": "Что не так и что сделать — простым языком"
    }
  ]
}
Если проблем нет — verdict "ok" и пустой массив issues.`

func (h *AIHandler) ReviewApplication(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ServiceID string                 `json:"service_id"`
		FormData  map[string]interface{} `json:"form_data"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.ServiceID) == "" {
		respondErr(w, http.StatusBadRequest, "service_id required")
		return
	}

	type svc struct {
		Title            string       `db:"title"`
		FormSchema       models.JSONB `db:"form_schema"`
		EligibilityRules models.JSONB `db:"eligibility_rules"`
	}
	var s svc
	if err := h.db.Get(&s,
		`SELECT title, form_schema, eligibility_rules FROM services WHERE id = $1`,
		req.ServiceID); err != nil {
		respondErr(w, http.StatusNotFound, "service not found")
		return
	}

	userContent, _ := json.Marshal(map[string]interface{}{
		"service_title":     s.Title,
		"form_schema":       s.FormSchema,
		"eligibility_rules": s.EligibilityRules,
		"form_data":         req.FormData,
	})

	var parsed struct {
		Verdict string `json:"verdict"`
		Summary string `json:"summary"`
		Issues  []struct {
			FieldID  string `json:"field_id"`
			Label    string `json:"label"`
			Severity string `json:"severity"`
			Message  string `json:"message"`
		} `json:"issues"`
	}
	if err := h.callClaudeJSON(r.Context(), reviewSystemPrompt, string(userContent), 1500, &parsed); err != nil {
		respondErr(w, http.StatusBadGateway, err.Error())
		return
	}

	issues := make([]map[string]interface{}, 0, len(parsed.Issues))
	for _, is := range parsed.Issues {
		sev := is.Severity
		if sev != "error" && sev != "warning" {
			sev = "warning"
		}
		issues = append(issues, map[string]interface{}{
			"field_id": is.FieldID,
			"label":    is.Label,
			"severity": sev,
			"message":  is.Message,
		})
	}
	verdict := parsed.Verdict
	if verdict != "ok" && verdict != "issues" {
		if len(issues) > 0 {
			verdict = "issues"
		} else {
			verdict = "ok"
		}
	}

	respond(w, http.StatusOK, map[string]interface{}{
		"verdict": verdict,
		"summary": parsed.Summary,
		"issues":  issues,
	})
}
