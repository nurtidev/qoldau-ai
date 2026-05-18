package handlers

import (
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
	"github.com/nurtidev/qoldau-ai/backend/internal/models"
)

type AuthHandler struct {
	db        *sqlx.DB
	jwtSecret string
}

func NewAuthHandler(db *sqlx.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IIN      string `json:"iin"`
		FullName string `json:"full_name"`
		OrgName  string `json:"org_name"`
	}
	if err := decode(r, &req); err != nil || req.IIN == "" {
		respondErr(w, http.StatusBadRequest, "iin and full_name required")
		return
	}

	var user models.User
	err := h.db.Get(&user, `SELECT * FROM users WHERE iin = $1`, req.IIN)
	if err != nil {
		// Auto-register user on first login (mock eGov flow)
		orgName := &req.OrgName
		if req.OrgName == "" {
			orgName = nil
		}
		err = h.db.QueryRowx(
			`INSERT INTO users (iin, full_name, org_name, role) VALUES ($1, $2, $3, 'user') RETURNING *`,
			req.IIN, req.FullName, orgName,
		).StructScan(&user)
		if err != nil {
			respondErr(w, http.StatusInternalServerError, "failed to create user")
			return
		}
	}

	token, err := h.generateToken(&user)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, "token generation failed")
		return
	}
	respond(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromCtx(r.Context())
	var user models.User
	if err := h.db.Get(&user, `SELECT * FROM users WHERE id = $1`, claims.UserID); err != nil {
		respondErr(w, http.StatusNotFound, "user not found")
		return
	}
	respond(w, http.StatusOK, user)
}

func (h *AuthHandler) generateToken(user *models.User) (string, error) {
	claims := middleware.Claims{
		UserID:   user.ID,
		IIN:      user.IIN,
		Role:     string(user.Role),
		FullName: user.FullName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}
