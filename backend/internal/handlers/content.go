package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

// uuidRe валидирует id из URL до запроса к БД: невалидный UUID Postgres
// роняет синтаксической ошибкой (22P02), а для клиента это тот же not found.
var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isUUID(s string) bool { return uuidRe.MatchString(s) }

// ContentHandler обслуживает публичный контент, управляемый из админки:
// аналитические материалы дочек (/materials) и проекты на карте (/map-projects).
type ContentHandler struct {
	db *sqlx.DB
}

func NewContentHandler(db *sqlx.DB) *ContentHandler {
	return &ContentHandler{db: db}
}

func validMaterialFormat(f string) bool {
	return f == "web" || f == "pdf" || f == "embed"
}

// deleteByID — единый паттерн удаления для контент-сущностей: 404 при
// невалидном id или отсутствующей строке (RowsAffected==0), 500 при ошибке БД.
func (h *ContentHandler) deleteByID(w http.ResponseWriter, table, id, notFoundMsg, failMsg string) {
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, notFoundMsg)
		return
	}
	res, err := h.db.Exec(`DELETE FROM `+table+` WHERE id=$1`, id) //nolint:gosec // table — константа из хендлера
	if err != nil {
		respondErr(w, http.StatusInternalServerError, failMsg)
		return
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		respondErr(w, http.StatusNotFound, notFoundMsg)
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// updateErr разводит ошибки Update*-хендлеров: sql.ErrNoRows → 404, иначе 500.
func updateErr(w http.ResponseWriter, err error, notFoundMsg, failMsg string) {
	if errors.Is(err, sql.ErrNoRows) {
		respondErr(w, http.StatusNotFound, notFoundMsg)
		return
	}
	respondErr(w, http.StatusInternalServerError, failMsg)
}

// ─── Analytics materials ─────────────────────────────────────────────────────

func (h *ContentHandler) ListMaterials(w http.ResponseWriter, r *http.Request) {
	items := make([]models.AnalyticsMaterial, 0)
	if err := h.db.Select(&items,
		`SELECT * FROM analytics_materials ORDER BY sort_order ASC, created_at ASC`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch materials")
		return
	}
	respond(w, http.StatusOK, items)
}

type materialReq struct {
	Title        string `json:"title"`
	Description  string `json:"description"`
	Org          string `json:"org"`
	MaterialType string `json:"material_type"`
	Period       string `json:"period"`
	Source       string `json:"source"`
	URL          string `json:"url"`
	Format       string `json:"format"`
	UpdatedDate  string `json:"updated_date"`
	SortOrder    int    `json:"sort_order"`
}

func (h *ContentHandler) CreateMaterial(w http.ResponseWriter, r *http.Request) {
	var req materialReq
	if err := decode(r, &req); err != nil || req.Title == "" {
		respondErr(w, http.StatusBadRequest, "title required")
		return
	}
	if req.Format == "" {
		req.Format = "web"
	}
	if !validMaterialFormat(req.Format) {
		respondErr(w, http.StatusBadRequest, "format must be one of web, pdf, embed")
		return
	}

	var m models.AnalyticsMaterial
	err := h.db.QueryRowx(
		`INSERT INTO analytics_materials
		   (title, description, org, material_type, period, source, url, format, updated_date, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
		req.Title, nullStr(req.Description), nullStr(req.Org), nullStr(req.MaterialType),
		nullStr(req.Period), nullStr(req.Source), nullStr(req.URL), req.Format,
		nullStr(req.UpdatedDate), req.SortOrder,
	).StructScan(&m)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create material")
		return
	}
	respond(w, http.StatusCreated, m)
}

func (h *ContentHandler) UpdateMaterial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "material not found")
		return
	}
	var req materialReq
	if err := decode(r, &req); err != nil || req.Title == "" {
		respondErr(w, http.StatusBadRequest, "title required")
		return
	}
	if req.Format == "" {
		req.Format = "web"
	}
	if !validMaterialFormat(req.Format) {
		respondErr(w, http.StatusBadRequest, "format must be one of web, pdf, embed")
		return
	}

	var m models.AnalyticsMaterial
	err := h.db.QueryRowx(
		`UPDATE analytics_materials SET
		   title=$1, description=$2, org=$3, material_type=$4, period=$5,
		   source=$6, url=$7, format=$8, updated_date=$9, sort_order=$10, updated_at=NOW()
		 WHERE id=$11 RETURNING *`,
		req.Title, nullStr(req.Description), nullStr(req.Org), nullStr(req.MaterialType),
		nullStr(req.Period), nullStr(req.Source), nullStr(req.URL), req.Format,
		nullStr(req.UpdatedDate), req.SortOrder, id,
	).StructScan(&m)
	if err != nil {
		updateErr(w, err, "material not found", "failed to update material")
		return
	}
	respond(w, http.StatusOK, m)
}

func (h *ContentHandler) DeleteMaterial(w http.ResponseWriter, r *http.Request) {
	h.deleteByID(w, "analytics_materials", chi.URLParam(r, "id"),
		"material not found", "failed to delete material")
}

// ─── Map projects ────────────────────────────────────────────────────────────

func (h *ContentHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	items := make([]models.MapProject, 0)
	if err := h.db.Select(&items,
		`SELECT * FROM map_projects ORDER BY sort_order ASC, created_at ASC`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch map projects")
		return
	}
	respond(w, http.StatusOK, items)
}

type projectReq struct {
	Name        string   `json:"name"`
	Org         string   `json:"org"`
	Region      string   `json:"region"`
	City        string   `json:"city"`
	Industry    string   `json:"industry"`
	Status      string   `json:"status"`
	Amount      float64  `json:"amount"`
	Period      string   `json:"period"`
	Description string   `json:"description"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
	SortOrder   int      `json:"sort_order"`
}

func (h *ContentHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req projectReq
	if err := decode(r, &req); err != nil || req.Name == "" {
		respondErr(w, http.StatusBadRequest, "name required")
		return
	}

	var p models.MapProject
	err := h.db.QueryRowx(
		`INSERT INTO map_projects
		   (name, org, region, city, industry, status, amount, period, description, lat, lng, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
		req.Name, nullStr(req.Org), nullStr(req.Region), nullStr(req.City),
		nullStr(req.Industry), nullStr(req.Status), req.Amount, nullStr(req.Period),
		nullStr(req.Description), req.Lat, req.Lng, req.SortOrder,
	).StructScan(&p)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create map project")
		return
	}
	respond(w, http.StatusCreated, p)
}

func (h *ContentHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "map project not found")
		return
	}
	var req projectReq
	if err := decode(r, &req); err != nil || req.Name == "" {
		respondErr(w, http.StatusBadRequest, "name required")
		return
	}

	var p models.MapProject
	err := h.db.QueryRowx(
		`UPDATE map_projects SET
		   name=$1, org=$2, region=$3, city=$4, industry=$5, status=$6,
		   amount=$7, period=$8, description=$9, lat=$10, lng=$11, sort_order=$12, updated_at=NOW()
		 WHERE id=$13 RETURNING *`,
		req.Name, nullStr(req.Org), nullStr(req.Region), nullStr(req.City),
		nullStr(req.Industry), nullStr(req.Status), req.Amount, nullStr(req.Period),
		nullStr(req.Description), req.Lat, req.Lng, req.SortOrder, id,
	).StructScan(&p)
	if err != nil {
		updateErr(w, err, "map project not found", "failed to update map project")
		return
	}
	respond(w, http.StatusOK, p)
}

func (h *ContentHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	h.deleteByID(w, "map_projects", chi.URLParam(r, "id"),
		"map project not found", "failed to delete map project")
}

// ─── News ────────────────────────────────────────────────────────────────────

func (h *ContentHandler) ListNews(w http.ResponseWriter, r *http.Request) {
	items := make([]models.News, 0)
	if err := h.db.Select(&items,
		`SELECT * FROM news ORDER BY published_at DESC NULLS LAST, sort_order ASC, created_at DESC`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch news")
		return
	}
	respond(w, http.StatusOK, items)
}

func (h *ContentHandler) GetNews(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var n models.News
	if err := h.db.Get(&n, `SELECT * FROM news WHERE id=$1`, id); err != nil {
		respondErr(w, http.StatusNotFound, "news not found")
		return
	}
	respond(w, http.StatusOK, n)
}

type newsReq struct {
	Title       string `json:"title"`
	Lead        string `json:"lead"`
	Body        string `json:"body"`
	Rubric      string `json:"rubric"`
	Source      string `json:"source"`
	SourceURL   string `json:"source_url"`
	ImageURL    string `json:"image_url"`
	PublishedAt string `json:"published_at"`
	IsFeatured  bool   `json:"is_featured"`
	SortOrder   int    `json:"sort_order"`
}

func (h *ContentHandler) CreateNews(w http.ResponseWriter, r *http.Request) {
	var req newsReq
	if err := decode(r, &req); err != nil || req.Title == "" {
		respondErr(w, http.StatusBadRequest, "title required")
		return
	}

	var n models.News
	err := h.db.QueryRowx(
		`INSERT INTO news
		   (title, lead, body, rubric, source, source_url, image_url, published_at, is_featured, sort_order)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
		req.Title, nullStr(req.Lead), nullStr(req.Body), nullStr(req.Rubric), nullStr(req.Source),
		nullStr(req.SourceURL), nullStr(req.ImageURL), nullStr(req.PublishedAt), req.IsFeatured, req.SortOrder,
	).StructScan(&n)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create news")
		return
	}
	respond(w, http.StatusCreated, n)
}

func (h *ContentHandler) UpdateNews(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "news not found")
		return
	}
	var req newsReq
	if err := decode(r, &req); err != nil || req.Title == "" {
		respondErr(w, http.StatusBadRequest, "title required")
		return
	}

	var n models.News
	err := h.db.QueryRowx(
		`UPDATE news SET
		   title=$1, lead=$2, body=$3, rubric=$4, source=$5, source_url=$6,
		   image_url=$7, published_at=$8, is_featured=$9, sort_order=$10, updated_at=NOW()
		 WHERE id=$11 RETURNING *`,
		req.Title, nullStr(req.Lead), nullStr(req.Body), nullStr(req.Rubric), nullStr(req.Source),
		nullStr(req.SourceURL), nullStr(req.ImageURL), nullStr(req.PublishedAt), req.IsFeatured, req.SortOrder, id,
	).StructScan(&n)
	if err != nil {
		updateErr(w, err, "news not found", "failed to update news")
		return
	}
	respond(w, http.StatusOK, n)
}

func (h *ContentHandler) DeleteNews(w http.ResponseWriter, r *http.Request) {
	h.deleteByID(w, "news", chi.URLParam(r, "id"),
		"news not found", "failed to delete news")
}

// ─── Holding stats ─────────────────────────────────────────────────────────────

func (h *ContentHandler) ListHoldingStats(w http.ResponseWriter, r *http.Request) {
	items := make([]models.HoldingStat, 0)
	if err := h.db.Select(&items,
		`SELECT * FROM holding_stats ORDER BY sort_order ASC, created_at ASC`); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch holding stats")
		return
	}
	respond(w, http.StatusOK, items)
}

// holdingStatReq — набор фиксирован, поэтому правятся только эти поля
// (stat_key неизменен, создания/удаления нет).
type holdingStatReq struct {
	Value     string `json:"value"`
	Label     string `json:"label"`
	AsOf      string `json:"asof"`
	SortOrder int    `json:"sort_order"`
}

func (h *ContentHandler) UpdateHoldingStat(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "holding stat not found")
		return
	}
	var req holdingStatReq
	if err := decode(r, &req); err != nil || req.Value == "" || req.Label == "" {
		respondErr(w, http.StatusBadRequest, "value and label required")
		return
	}

	var s models.HoldingStat
	err := h.db.QueryRowx(
		`UPDATE holding_stats SET value=$1, label=$2, asof=$3, sort_order=$4, updated_at=NOW()
		 WHERE id=$5 RETURNING *`,
		req.Value, req.Label, nullStr(req.AsOf), req.SortOrder, id,
	).StructScan(&s)
	if err != nil {
		updateErr(w, err, "holding stat not found", "failed to update holding stat")
		return
	}
	respond(w, http.StatusOK, s)
}

// ─── Service FAQ ─────────────────────────────────────────────────────────────
// «Вопросы и ответы» на детальной странице услуги. service_id IS NULL — общий
// вопрос портала (виден на всех услугах); иначе привязан к конкретной услуге.

// ListFAQ: GET /api/faq[?service_id=<uuid>][?scope=all].
//   - scope=all — все вопросы (для админ-таблицы): общие + все привязанные.
//   - service_id=<uuid> — общие + привязанные к услуге (детальная страница).
//   - без параметров — только общие вопросы портала.
// Специфичные вопросы идут первыми (Kaspi-порядок), затем общие; внутри —
// по sort_order.
func (h *ContentHandler) ListFAQ(w http.ResponseWriter, r *http.Request) {
	items := make([]models.ServiceFAQ, 0)
	serviceID := r.URL.Query().Get("service_id")

	if r.URL.Query().Get("scope") == "all" {
		if err := h.db.Select(&items,
			`SELECT * FROM service_faq
			 ORDER BY (service_id IS NULL) ASC, sort_order ASC, created_at ASC`); err != nil {
			respondErr(w, http.StatusInternalServerError, "failed to fetch faq")
			return
		}
		respond(w, http.StatusOK, items)
		return
	}

	var err error
	if serviceID == "" {
		err = h.db.Select(&items,
			`SELECT * FROM service_faq WHERE service_id IS NULL
			 ORDER BY sort_order ASC, created_at ASC`)
	} else {
		if !isUUID(serviceID) {
			respondErr(w, http.StatusBadRequest, "invalid service_id")
			return
		}
		err = h.db.Select(&items,
			`SELECT * FROM service_faq WHERE service_id IS NULL OR service_id=$1
			 ORDER BY (service_id IS NULL) ASC, sort_order ASC, created_at ASC`, serviceID)
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch faq")
		return
	}
	respond(w, http.StatusOK, items)
}

type faqVoteReq struct {
	Helpful bool `json:"helpful"`
}

// VoteFAQ: POST /api/faq/{id}/vote — публичный инкремент счётчика.
// MVP без дедупликации по пользователю (осознанно) — защита от повторов
// живёт на фронте в localStorage.
func (h *ContentHandler) VoteFAQ(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "faq not found")
		return
	}
	var req faqVoteReq
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	col := "down_votes"
	if req.Helpful {
		col = "up_votes"
	}
	var f models.ServiceFAQ
	err := h.db.QueryRowx(
		`UPDATE service_faq SET `+col+`=`+col+`+1, updated_at=NOW() WHERE id=$1 RETURNING *`, //nolint:gosec // col — константа
		id,
	).StructScan(&f)
	if err != nil {
		updateErr(w, err, "faq not found", "failed to record vote")
		return
	}
	respond(w, http.StatusOK, f)
}

type faqReq struct {
	ServiceID *string `json:"service_id"` // nil / "" → общий вопрос
	Question  string  `json:"question"`
	Answer    string  `json:"answer"`
	SortOrder int     `json:"sort_order"`
}

// serviceIDArg нормализует необязательный service_id: пустая строка → NULL,
// невалидный UUID → ошибка. Возвращает (value, ok).
func serviceIDArg(w http.ResponseWriter, raw *string) (interface{}, bool) {
	if raw == nil || *raw == "" {
		return nil, true
	}
	if !isUUID(*raw) {
		respondErr(w, http.StatusBadRequest, "invalid service_id")
		return nil, false
	}
	return *raw, true
}

func (h *ContentHandler) CreateFAQ(w http.ResponseWriter, r *http.Request) {
	var req faqReq
	if err := decode(r, &req); err != nil || req.Question == "" || req.Answer == "" {
		respondErr(w, http.StatusBadRequest, "question and answer required")
		return
	}
	sid, ok := serviceIDArg(w, req.ServiceID)
	if !ok {
		return
	}

	var f models.ServiceFAQ
	err := h.db.QueryRowx(
		`INSERT INTO service_faq (service_id, question, answer, sort_order)
		 VALUES ($1,$2,$3,$4) RETURNING *`,
		sid, req.Question, req.Answer, req.SortOrder,
	).StructScan(&f)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to create faq")
		return
	}
	respond(w, http.StatusCreated, f)
}

func (h *ContentHandler) UpdateFAQ(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		respondErr(w, http.StatusNotFound, "faq not found")
		return
	}
	var req faqReq
	if err := decode(r, &req); err != nil || req.Question == "" || req.Answer == "" {
		respondErr(w, http.StatusBadRequest, "question and answer required")
		return
	}
	sid, ok := serviceIDArg(w, req.ServiceID)
	if !ok {
		return
	}

	var f models.ServiceFAQ
	err := h.db.QueryRowx(
		`UPDATE service_faq SET service_id=$1, question=$2, answer=$3, sort_order=$4, updated_at=NOW()
		 WHERE id=$5 RETURNING *`,
		sid, req.Question, req.Answer, req.SortOrder, id,
	).StructScan(&f)
	if err != nil {
		updateErr(w, err, "faq not found", "failed to update faq")
		return
	}
	respond(w, http.StatusOK, f)
}

func (h *ContentHandler) DeleteFAQ(w http.ResponseWriter, r *http.Request) {
	h.deleteByID(w, "service_faq", chi.URLParam(r, "id"),
		"faq not found", "failed to delete faq")
}
