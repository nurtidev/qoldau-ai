package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

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
		respondErr(w, http.StatusInternalServerError, "failed to update material")
		return
	}
	respond(w, http.StatusOK, m)
}

func (h *ContentHandler) DeleteMaterial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.db.Exec(`DELETE FROM analytics_materials WHERE id=$1`, id); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to delete material")
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "deleted"})
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
		respondErr(w, http.StatusInternalServerError, "failed to update map project")
		return
	}
	respond(w, http.StatusOK, p)
}

func (h *ContentHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := h.db.Exec(`DELETE FROM map_projects WHERE id=$1`, id); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to delete map project")
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "deleted"})
}
