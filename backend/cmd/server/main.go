package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/nurtidev/qoldau-ai/backend/internal/config"
	"github.com/nurtidev/qoldau-ai/backend/internal/db"
	"github.com/nurtidev/qoldau-ai/backend/internal/handlers"
	"github.com/nurtidev/qoldau-ai/backend/internal/middleware"
)

func main() {
	cfg := config.Load()

	database, err := db.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer database.Close()

	if err := db.RunMigrations(database, "./migrations"); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	_, err = db.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Printf("redis warning: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0755); err != nil {
		log.Fatalf("upload dir: %v", err)
	}

	// Handlers
	authH := handlers.NewAuthHandler(database, cfg.JWTSecret)
	servicesH := handlers.NewServicesHandler(database)
	appsH := handlers.NewApplicationsHandler(database)
	docsH := handlers.NewDocumentsHandler(database, cfg.UploadDir)
	notifsH := handlers.NewNotificationsHandler(database)
	aiH := handlers.NewAIHandler(cfg.AnthropicAPIKey, database)
	mockH := handlers.NewMockHandler()
	analyticsH := handlers.NewAnalyticsHandler(database)
	audienceH := handlers.NewAudienceHandler(database)
	funnelH := handlers.NewFunnelHandler(database)
	leadsH := handlers.NewLeadsHandler(database)
	usersH := handlers.NewUsersHandler(database)
	contentH := handlers.NewContentHandler(database)

	authMw := middleware.Auth(cfg.JWTSecret)
	adminMw := middleware.RequireRole("admin")
	adminAuthorMw := middleware.RequireRole("admin", "author")

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Static file serving for uploads — requires auth so documents stay private
	r.With(authMw).Handle("/uploads/*", http.StripPrefix("/uploads/",
		http.FileServer(http.Dir(cfg.UploadDir))))

	r.Get("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api", func(r chi.Router) {
		// Auth
		r.Post("/auth/login", authH.Login)
		r.With(authMw).Get("/auth/me", authH.Me)

		// Services
		r.Route("/services", func(r chi.Router) {
			r.Get("/", servicesH.List)
			r.Get("/{id}", servicesH.Get)
			r.With(authMw, adminAuthorMw).Post("/", servicesH.Create)
			r.With(authMw, adminAuthorMw).Put("/{id}", servicesH.Update)
			r.With(authMw, adminMw).Delete("/{id}", servicesH.Delete)
			r.With(authMw, adminMw).Post("/{id}/publish", servicesH.Publish)
			// Audience reach calculator + broadcast
			r.With(authMw, adminAuthorMw).Post("/{id}/audience", audienceH.Match)
			r.With(authMw, adminMw).Post("/{id}/broadcast", audienceH.Broadcast)
			// Funnel analytics: view tracking + aggregated lifecycle funnel
			r.Post("/{id}/view", funnelH.LogView)
			r.With(authMw, adminAuthorMw).Get("/{id}/funnel", funnelH.Funnel)
		})

		// Audience snapshot (regions/sectors enumeration for filter UI)
		r.With(authMw, adminAuthorMw).Get("/audience/snapshot", audienceH.Snapshot)

		// AI
		r.With(authMw).Post("/ai/generate-form", aiH.GenerateForm)
		r.With(authMw).Post("/ai/generate-form-stream", aiH.GenerateFormStream)
		r.With(authMw).Post("/ai/recommend", aiH.Recommend)
		// Client-path AI (public — juries view cards before login):
		r.Post("/ai/explain-service", aiH.ExplainService) // SSE stream, plain-language explainer
		r.Post("/ai/pick-service", aiH.PickService)       // screener → AI match
		r.With(authMw).Post("/ai/review-application", aiH.ReviewApplication)
		// AI-инсайты для автора услуги (по накопленным данным) — admin+author.
		r.With(authMw, adminAuthorMw).Post("/ai/service-insights", aiH.ServiceInsights)

		// Applications
		r.Route("/applications", func(r chi.Router) {
			r.Use(authMw)
			r.Post("/", appsH.Create)
			r.Get("/", appsH.List)
			r.Get("/{id}", appsH.Get)
			r.With(adminMw).Put("/{id}/status", appsH.UpdateStatus)
			// Nudge a draft's owner to finish their application (admin analytics widget)
			r.With(adminMw).Post("/{id}/nudge", appsH.Nudge)
			// Stage 2: applicant provides the additional data/documents requested
			r.Post("/{id}/stage2", appsH.SubmitStage2)
			// Funnel step event
			r.Post("/{id}/event", funnelH.LogEvent)
		})

		// Documents
		r.Route("/documents", func(r chi.Router) {
			r.Use(authMw)
			r.Get("/", docsH.ListAll)
			r.Post("/upload", docsH.Upload)
			r.Get("/{app_id}", docsH.ListByApplication)
		})

		// Notifications
		r.Route("/notifications", func(r chi.Router) {
			r.Use(authMw)
			r.Get("/", notifsH.List)
			r.Put("/{id}/read", notifsH.MarkRead)
		})

		// Mock integrations
		r.Get("/mock/egov/{iin}", mockH.EGov)
		r.Get("/mock/kgd/{bin}", mockH.KGD)
		r.Get("/mock/isz/{iin_or_bin}", mockH.ISZ)
		r.Post("/mock/eish/submit", mockH.EISHSubmit)
		r.Post("/mock/ecp/sign", mockH.ECPSign)

		// Users (admin only)
		r.With(authMw, adminMw).Get("/users", usersH.List)
		r.With(authMw, adminMw).Put("/users/{id}/role", usersH.SetRole)
		r.With(authMw, adminMw).Delete("/users/{id}", usersH.Delete)

		// Analytics (admin only)
		r.With(authMw, adminMw).Get("/analytics/summary", analyticsH.Summary)
		r.With(authMw, adminMw).Get("/analytics/quality", analyticsH.Quality)

		// Leads ("Перезвоните мне" widget) — POST is public, list is admin-only.
		r.Post("/leads", leadsH.Create)
		r.With(authMw, adminMw).Get("/leads", leadsH.List)

		// Content catalog (managed from admin): analytics materials + map projects.
		// GET public; writes require admin/author.
		r.Route("/materials", func(r chi.Router) {
			r.Get("/", contentH.ListMaterials)
			r.With(authMw, adminAuthorMw).Post("/", contentH.CreateMaterial)
			r.With(authMw, adminAuthorMw).Put("/{id}", contentH.UpdateMaterial)
			r.With(authMw, adminAuthorMw).Delete("/{id}", contentH.DeleteMaterial)
		})
		r.Route("/map-projects", func(r chi.Router) {
			r.Get("/", contentH.ListProjects)
			r.With(authMw, adminAuthorMw).Post("/", contentH.CreateProject)
			r.With(authMw, adminAuthorMw).Put("/{id}", contentH.UpdateProject)
			r.With(authMw, adminAuthorMw).Delete("/{id}", contentH.DeleteProject)
		})
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server starting on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server: %v", err)
	}
}
