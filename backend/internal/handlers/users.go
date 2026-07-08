package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type UsersHandler struct {
	db *sqlx.DB
}

func NewUsersHandler(db *sqlx.DB) *UsersHandler {
	return &UsersHandler{db: db}
}

// userListItem is the trimmed projection returned by the admin users list —
// core identity fields plus a computed applications count.
type userListItem struct {
	ID                string    `db:"id"                 json:"id"`
	IIN               string    `db:"iin"                json:"iin"`
	FullName          string    `db:"full_name"          json:"full_name"`
	OrgName           *string   `db:"org_name"           json:"org_name,omitempty"`
	Role              string    `db:"role"               json:"role"`
	CreatedAt         time.Time `db:"created_at"         json:"created_at"`
	ApplicationsCount int       `db:"applications_count" json:"applications_count"`
}

// List returns a paginated, filterable slice of users (admin-only).
// Query params: role (user|author|admin), q (ILIKE over full_name/iin/org_name),
// limit (default 50, max 100), offset. Response: { items: [...], total: N }.
func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var where []string
	var args []interface{}
	n := 1

	if role := q.Get("role"); role == "user" || role == "author" || role == "admin" {
		where = append(where, fmt.Sprintf("u.role = $%d", n))
		args = append(args, role)
		n++
	}
	if search := strings.TrimSpace(q.Get("q")); search != "" {
		where = append(where, fmt.Sprintf(
			"(u.full_name ILIKE $%d OR u.iin ILIKE $%d OR COALESCE(u.org_name, '') ILIKE $%d)", n, n, n))
		args = append(args, "%"+search+"%")
		n++
	}

	whereSQL := ""
	if len(where) > 0 {
		whereSQL = "WHERE " + strings.Join(where, " AND ")
	}

	// total under the same filter (drives pagination)
	var total int
	if err := h.db.Get(&total, "SELECT COUNT(*) FROM users u "+whereSQL, args...); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to count users")
		return
	}

	limit := 50
	if l := q.Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if limit > 100 {
		limit = 100
	}
	offset := 0
	if o := q.Get("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil && v >= 0 {
			offset = v
		}
	}

	listArgs := append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT u.id, u.iin, u.full_name, u.org_name, u.role, u.created_at,
		       (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS applications_count
		FROM users u
		%s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, n, n+1)

	items := make([]userListItem, 0)
	if err := h.db.Select(&items, query, listArgs...); err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to fetch users")
		return
	}

	respond(w, http.StatusOK, map[string]interface{}{
		"items": items,
		"total": total,
	})
}

// SetRole updates a single user's role (admin-only). An admin may not change
// their own role (guards against accidental self-demotion).
func (h *UsersHandler) SetRole(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	id := chi.URLParam(r, "id")

	var req struct {
		Role string `json:"role"`
	}
	if err := decode(r, &req); err != nil {
		respondErr(w, http.StatusBadRequest, "role required")
		return
	}
	if req.Role != "user" && req.Role != "author" && req.Role != "admin" {
		respondErr(w, http.StatusBadRequest, "invalid role")
		return
	}
	if claims != nil && id == claims.UserID {
		respondErr(w, http.StatusBadRequest, "cannot change your own role")
		return
	}

	var user models.User
	err := h.db.QueryRowx(
		`UPDATE users SET role = $1 WHERE id = $2 RETURNING *`,
		req.Role, id,
	).StructScan(&user)
	if err == sql.ErrNoRows {
		respondErr(w, http.StatusNotFound, "user not found")
		return
	}
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "failed to update role")
		return
	}

	respond(w, http.StatusOK, user)
}
