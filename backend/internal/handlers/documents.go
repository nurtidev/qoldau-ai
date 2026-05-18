package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type DocumentsHandler struct {
	db        *sqlx.DB
	uploadDir string
}

func NewDocumentsHandler(db *sqlx.DB, uploadDir string) *DocumentsHandler {
	os.MkdirAll(uploadDir, 0755)
	return &DocumentsHandler{db: db, uploadDir: uploadDir}
}

func (h *DocumentsHandler) Upload(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		respondErr(w, http.StatusBadRequest, "failed to parse form")
		return
	}

	applicationID := r.FormValue("application_id")
	if applicationID == "" {
		respondErr(w, http.StatusBadRequest, "application_id required")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondErr(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()

	ext := filepath.Ext(header.Filename)
	allowed := map[string]bool{".pdf": true, ".xlsx": true, ".docx": true, ".jpg": true, ".png": true}
	if !allowed[strings.ToLower(ext)] {
		respondErr(w, http.StatusBadRequest, "unsupported file type")
		return
	}

	filename := uuid.New().String() + ext
	dstPath := filepath.Join(h.uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dst.Close()
	if _, err = io.Copy(dst, file); err != nil {
		os.Remove(dstPath)
		respondErr(w, http.StatusInternalServerError, "failed to write file")
		return
	}

	fileURL := fmt.Sprintf("/uploads/%s", filename)

	var doc models.Document
	err = h.db.QueryRowx(
		`INSERT INTO documents (application_id, name, file_url, uploaded_by)
		 VALUES ($1, $2, $3, $4) RETURNING *`,
		applicationID, header.Filename, fileURL, claims.UserID,
	).StructScan(&doc)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to save document record")
		return
	}
	respond(w, http.StatusCreated, doc)
}

func (h *DocumentsHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	docs := []models.Document{}
	if err := h.db.Select(&docs,
		`SELECT d.* FROM documents d
		 JOIN applications a ON a.id = d.application_id
		 WHERE a.user_id = $1
		 ORDER BY d.created_at DESC`, claims.UserID); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch documents")
		return
	}
	respond(w, http.StatusOK, docs)
}

func (h *DocumentsHandler) ListByApplication(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	appID := chi.URLParam(r, "app_id")

	// Verify the requester owns this application (or is admin)
	if claims.Role != "admin" {
		var ownerID string
		if err := h.db.Get(&ownerID, `SELECT user_id FROM applications WHERE id = $1`, appID); err != nil {
			respondErr(w, http.StatusNotFound, "application not found")
			return
		}
		if ownerID != claims.UserID {
			respondErr(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	var docs []models.Document
	if err := h.db.Select(&docs,
		`SELECT * FROM documents WHERE application_id = $1 ORDER BY created_at DESC`, appID); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch documents")
		return
	}
	respond(w, http.StatusOK, docs)
}
