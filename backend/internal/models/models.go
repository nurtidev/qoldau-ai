package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a map that serializes to/from PostgreSQL JSONB.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONB) Scan(src interface{}) error {
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return fmt.Errorf("unsupported type: %T", src)
	}
	return json.Unmarshal(b, j)
}

// User roles
type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleAuthor UserRole = "author"
	RoleUser   UserRole = "user"
)

type User struct {
	ID        string    `db:"id"         json:"id"`
	IIN       string    `db:"iin"        json:"iin"`
	FullName  string    `db:"full_name"  json:"full_name"`
	OrgName   *string   `db:"org_name"   json:"org_name,omitempty"`
	Role      UserRole  `db:"role"       json:"role"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`

	// Audience profile (added by migration 005_audience). Optional for real users —
	// populated only for synthetic seed data and (future) eGov-prefilled profiles.
	Sector             *string `db:"sector"               json:"sector,omitempty"`
	BusinessAgeMonths  *int    `db:"business_age_months"  json:"business_age_months,omitempty"`
	AnnualRevenue      *int64  `db:"annual_revenue"       json:"annual_revenue,omitempty"`
	Region             *string `db:"region"               json:"region,omitempty"`
	OKED               *string `db:"oked"                 json:"oked,omitempty"`
	Headcount          *int    `db:"headcount"            json:"headcount,omitempty"`
	MsbCategory        *string `db:"msb_category"         json:"msb_category,omitempty"`
	HasTaxDebt         *bool   `db:"has_tax_debt"         json:"has_tax_debt,omitempty"`
	InRiskRegister     *bool   `db:"in_risk_register"     json:"in_risk_register,omitempty"`
	OwnerAge           *int    `db:"owner_age"            json:"owner_age,omitempty"`
	IsSynthetic        *bool   `db:"is_synthetic"         json:"is_synthetic,omitempty"`
}

// Service statuses
type ServiceStatus string

const (
	ServiceDraft     ServiceStatus = "draft"
	ServicePublished ServiceStatus = "published"
)

type Service struct {
	ID               string        `db:"id"                 json:"id"`
	Title            string        `db:"title"              json:"title"`
	Description      *string       `db:"description"        json:"description,omitempty"`
	Category         *string       `db:"category"           json:"category,omitempty"`
	OrgName          *string       `db:"org_name"           json:"org_name,omitempty"`
	Status           ServiceStatus `db:"status"             json:"status"`
	FormSchema       JSONB         `db:"form_schema"        json:"form_schema"`
	EligibilityRules JSONB         `db:"eligibility_rules"  json:"eligibility_rules"`
	CreatedBy        *string       `db:"created_by"         json:"created_by,omitempty"`
	CreatedAt        time.Time     `db:"created_at"         json:"created_at"`

	// Program terms (008_program_terms). All optional — non-credit programs (grants,
	// guarantees, consulting) may leave rate/term NULL while still exposing max_amount.
	InterestRate   *float64 `db:"interest_rate"    json:"interest_rate,omitempty"`
	MaxAmount      *int64   `db:"max_amount"       json:"max_amount,omitempty"`
	MaxTermMonths  *int     `db:"max_term_months"  json:"max_term_months,omitempty"`
}

type Lead struct {
	ID        string    `db:"id"          json:"id"`
	Name      string    `db:"name"        json:"name"`
	Phone     string    `db:"phone"       json:"phone"`
	ServiceID *string   `db:"service_id"  json:"service_id,omitempty"`
	Message   *string   `db:"message"     json:"message,omitempty"`
	Status    string    `db:"status"      json:"status"`
	CreatedAt time.Time `db:"created_at"  json:"created_at"`
}

type LeadWithService struct {
	Lead
	ServiceTitle *string `db:"service_title" json:"service_title,omitempty"`
}

// Application statuses
type ApplicationStatus string

const (
	AppDraft         ApplicationStatus = "draft"
	AppSubmitted     ApplicationStatus = "submitted"
	AppInReview      ApplicationStatus = "in_review"
	AppDocsRequested ApplicationStatus = "docs_requested"
	AppApproved      ApplicationStatus = "approved"
	AppRejected      ApplicationStatus = "rejected"
)

type Application struct {
	ID          string            `db:"id"            json:"id"`
	ServiceID   string            `db:"service_id"    json:"service_id"`
	UserID      string            `db:"user_id"       json:"user_id"`
	FormData    JSONB             `db:"form_data"     json:"form_data"`
	Status      ApplicationStatus `db:"status"        json:"status"`
	Stage       int               `db:"stage"          json:"stage"`
	RequestMessage string         `db:"request_message" json:"request_message"`
	IsSynthetic bool              `db:"is_synthetic"  json:"is_synthetic"`
	CreatedAt   time.Time         `db:"created_at"    json:"created_at"`
	UpdatedAt   time.Time         `db:"updated_at"    json:"updated_at"`
}

type ApplicationWithService struct {
	Application
	ServiceTitle string `db:"service_title" json:"service_title"`
	// Заявитель (JOIN users) — заполняется только в админ-списке заявок.
	// В остальных запросах этой структуры остаётся пустым (sqlx не требует колонку).
	ApplicantName string `db:"applicant_name" json:"applicant_name"`
	ApplicantOrg  string `db:"applicant_org"  json:"applicant_org"`
}

type Document struct {
	ID            string    `db:"id"             json:"id"`
	ApplicationID string    `db:"application_id" json:"application_id"`
	Name          string    `db:"name"           json:"name"`
	FileURL       string    `db:"file_url"       json:"file_url"`
	UploadedBy    *string   `db:"uploaded_by"    json:"uploaded_by,omitempty"`
	CreatedAt     time.Time `db:"created_at"     json:"created_at"`
}

type Notification struct {
	ID        string    `db:"id"         json:"id"`
	UserID    string    `db:"user_id"    json:"user_id"`
	Title     string    `db:"title"      json:"title"`
	Message   *string   `db:"message"    json:"message,omitempty"`
	IsRead    bool      `db:"is_read"    json:"is_read"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// AnalyticsMaterial — аналитический материал дочерней организации,
// отображается в публичном каталоге /analytics (миграция 014).
type AnalyticsMaterial struct {
	ID           string    `db:"id"            json:"id"`
	Title        string    `db:"title"         json:"title"`
	Description  *string   `db:"description"   json:"description,omitempty"`
	Org          *string   `db:"org"           json:"org,omitempty"`
	MaterialType *string   `db:"material_type" json:"material_type,omitempty"`
	Period       *string   `db:"period"        json:"period,omitempty"`
	Source       *string   `db:"source"        json:"source,omitempty"`
	URL          *string   `db:"url"           json:"url,omitempty"`
	Format       string    `db:"format"        json:"format"`
	UpdatedDate  *string   `db:"updated_date"  json:"updated_date,omitempty"`
	SortOrder    int       `db:"sort_order"    json:"sort_order"`
	CreatedAt    time.Time `db:"created_at"    json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"    json:"updated_at"`
}

// News — новостной материал editorial-раздела /news (миграция 016).
// Управляется из админ-кабинета; PublishedAt хранит только дату.
type News struct {
	ID          string     `db:"id"           json:"id"`
	Title       string     `db:"title"        json:"title"`
	Lead        *string    `db:"lead"         json:"lead,omitempty"`
	Body        *string    `db:"body"         json:"body,omitempty"`
	Rubric      *string    `db:"rubric"       json:"rubric,omitempty"`
	Source      *string    `db:"source"       json:"source,omitempty"`
	SourceURL   *string    `db:"source_url"   json:"source_url,omitempty"`
	ImageURL    *string    `db:"image_url"    json:"image_url,omitempty"`
	PublishedAt *time.Time `db:"published_at" json:"published_at,omitempty"`
	IsFeatured  bool       `db:"is_featured"  json:"is_featured"`
	SortOrder   int        `db:"sort_order"   json:"sort_order"`
	CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at"   json:"updated_at"`
}

// KnowledgeArticle — статья базы знаний раздела /knowledge (миграция 020).
// Управляется из админ-кабинета; Body хранится в markdown-подобном формате.
type KnowledgeArticle struct {
	ID          string     `db:"id"           json:"id"`
	Slug        string     `db:"slug"         json:"slug"`
	Category    string     `db:"category"     json:"category"`
	Title       string     `db:"title"        json:"title"`
	Excerpt     *string    `db:"excerpt"      json:"excerpt,omitempty"`
	Body        string     `db:"body"         json:"body"`
	ReadMinutes *int       `db:"read_minutes" json:"read_minutes,omitempty"`
	PublishedAt *time.Time `db:"published_at"  json:"published_at,omitempty"`
	SortOrder   int        `db:"sort_order"   json:"sort_order"`
	CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at"   json:"updated_at"`
}

// MapProject — проект на публичной карте /projects-map (миграция 014).
// Lat/Lng nullable: если пусто, фронт берёт координаты центра региона.
type MapProject struct {
	ID          string    `db:"id"          json:"id"`
	Name        string    `db:"name"        json:"name"`
	Org         *string   `db:"org"         json:"org,omitempty"`
	Region      *string   `db:"region"      json:"region,omitempty"`
	City        *string   `db:"city"        json:"city,omitempty"`
	Industry    *string   `db:"industry"    json:"industry,omitempty"`
	Status      *string   `db:"status"      json:"status,omitempty"`
	Amount      float64   `db:"amount"      json:"amount"`
	Period      *string   `db:"period"      json:"period,omitempty"`
	Description *string   `db:"description" json:"description,omitempty"`
	Lat         *float64  `db:"lat"         json:"lat,omitempty"`
	Lng         *float64  `db:"lng"         json:"lng,omitempty"`
	SortOrder   int       `db:"sort_order"  json:"sort_order"`
	CreatedAt   time.Time `db:"created_at"  json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"  json:"updated_at"`
}

// HoldingStat — администрируемая цифра о холдинге «Байтерек» для секции
// «Институт развития страны» на главной (миграция 017). Набор фиксированный:
// value/label/asof правятся из админки, создание/удаление не предусмотрены.
type HoldingStat struct {
	ID        string    `db:"id"         json:"id"`
	StatKey   string    `db:"stat_key"   json:"stat_key"`
	Value     string    `db:"value"      json:"value"`
	Label     string    `db:"label"      json:"label"`
	AsOf      *string   `db:"asof"       json:"asof,omitempty"`
	SortOrder int       `db:"sort_order" json:"sort_order"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// ServiceFAQ — вопрос-ответ на детальной странице услуги (миграция 018).
// ServiceID nullable: NULL — общий вопрос портала (виден на всех услугах),
// иначе привязан к конкретной услуге. UpVotes/DownVotes — голоса «был ли
// ответ полезен» (инкремент публичный, без дедупликации на бэкенде).
type ServiceFAQ struct {
	ID        string    `db:"id"         json:"id"`
	ServiceID *string   `db:"service_id" json:"service_id,omitempty"`
	Question  string    `db:"question"   json:"question"`
	Answer    string    `db:"answer"     json:"answer"`
	SortOrder int       `db:"sort_order" json:"sort_order"`
	UpVotes   int       `db:"up_votes"   json:"up_votes"`
	DownVotes int       `db:"down_votes" json:"down_votes"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}
