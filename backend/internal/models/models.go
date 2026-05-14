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
}

// Application statuses
type ApplicationStatus string

const (
	AppDraft    ApplicationStatus = "draft"
	AppSubmitted ApplicationStatus = "submitted"
	AppInReview ApplicationStatus = "in_review"
	AppApproved ApplicationStatus = "approved"
	AppRejected ApplicationStatus = "rejected"
)

type Application struct {
	ID        string            `db:"id"         json:"id"`
	ServiceID string            `db:"service_id" json:"service_id"`
	UserID    string            `db:"user_id"    json:"user_id"`
	FormData  JSONB             `db:"form_data"  json:"form_data"`
	Status    ApplicationStatus `db:"status"     json:"status"`
	CreatedAt time.Time         `db:"created_at" json:"created_at"`
	UpdatedAt time.Time         `db:"updated_at" json:"updated_at"`
}

type ApplicationWithService struct {
	Application
	ServiceTitle string `db:"service_title" json:"service_title"`
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
