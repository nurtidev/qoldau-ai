package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
)

type MockHandler struct{}

func NewMockHandler() *MockHandler { return &MockHandler{} }

var egovData = map[string]map[string]interface{}{
	"default": {
		"full_name":     "Иванов Иван Иванович",
		"org_name":      "ТОО «Тест Компания»",
		"bin":           "123456789012",
		"org_type":      "МСБ",
		"region":        "Астана",
		"address":       "г. Астана, ул. Бейбитшилик, 18",
		"phone":         "+7 (701) 234-56-78",
		"registered_at": "2020-01-15",
	},
	"000000000000": {
		"full_name":     "Администратор",
		"org_name":      "АО «НИХ «Байтерек»",
		"bin":           "000000000000",
		"org_type":      "Крупный бизнес",
		"region":        "Астана",
		"address":       "г. Астана, пр. Мангилик Ел, 55А",
		"phone":         "+7 (7172) 79-70-70",
		"registered_at": "2010-06-01",
	},
}

func (h *MockHandler) EGov(w http.ResponseWriter, r *http.Request) {
	iin := chi.URLParam(r, "iin")
	data, ok := egovData[iin]
	if !ok {
		data = egovData["default"]
	}
	result := map[string]interface{}{
		"iin": iin,
	}
	for k, v := range data {
		result[k] = v
	}
	respond(w, http.StatusOK, result)
}

// KGD returns mock tax-authority (Комитет государственных доходов) data for a BIN/IIN.
// Mirrors the shape of cabinet.salyk.kz API responses: tax regime, revenue history,
// payroll fund, paid taxes, VAT status, OKED list, and current debt.
func (h *MockHandler) KGD(w http.ResponseWriter, r *http.Request) {
	bin := chi.URLParam(r, "bin")
	if bin == "" {
		respondErr(w, http.StatusBadRequest, "bin required")
		return
	}

	// Deterministic fake data — varies by last digit of BIN for variety
	last := byte('0')
	if len(bin) > 0 {
		last = bin[len(bin)-1]
	}
	revenueBase := 120000000 + int(last-'0')*15000000

	respond(w, http.StatusOK, map[string]interface{}{
		"bin":                bin,
		"tax_regime":         "Общеустановленный режим (ОУР)",
		"registration_date":  "2020-03-12",
		"is_vat_payer":       true,
		"vat_certificate_no": "60001-1900-AA-" + bin[len(bin)-4:],
		"current_tax_debt":   0,
		"current_pension_debt": 0,
		"last_filed_period":  "2026-Q1",
		"annual_revenue": []map[string]interface{}{
			{"year": 2023, "amount": revenueBase, "currency": "KZT"},
			{"year": 2024, "amount": int(float64(revenueBase) * 1.18), "currency": "KZT"},
			{"year": 2025, "amount": int(float64(revenueBase) * 1.34), "currency": "KZT"},
		},
		"employees_count":           24 + int(last-'0'),
		"wage_fund_annual":          8400000 + int(last-'0')*500000,
		"corporate_income_tax_paid": int(float64(revenueBase) * 0.13),
		"social_contributions_paid": 4200000,
		"okeds": []map[string]string{
			{"code": "49.41", "name": "Деятельность грузового автомобильного транспорта"},
			{"code": "52.29", "name": "Прочая вспомогательная транспортная деятельность"},
		},
		"violations":         []interface{}{},
		"in_risk_register":   false,
		"compliance_status":  "compliant",
		"data_source":        "mock cabinet.salyk.kz",
		"fetched_at":         "2026-05-14T10:23:00+05:00",
	})
}

func (h *MockHandler) EISHSubmit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ApplicationID string `json:"application_id"`
	}
	if err := decode(r, &req); err != nil || req.ApplicationID == "" {
		respondErr(w, http.StatusBadRequest, "application_id required")
		return
	}
	respond(w, http.StatusOK, map[string]interface{}{
		"status":      "accepted",
		"external_id": fmt.Sprintf("EISH-2026-%05d", len(req.ApplicationID)),
		"message":     "Заявка передана в BPM систему",
	})
}

// ecpSeq is an in-memory incrementing counter for mock signature IDs — mirrors
// the len()-based counter used by EISHSubmit, just monotonic across requests.
var ecpSeq int64

// ECPSign imitates an EDS (ЭЦП) signing round-trip against NCALayer / НУЦ РК,
// as referenced in the hackathon spec (п. 6.12 «Имитация интеграций» — «проверка
// ЭЦП»). No real cryptography: it returns a plausible-looking signature envelope
// so the frontend can demo a sign-before-submit flow.
func (h *MockHandler) ECPSign(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IIN      string `json:"iin"`
		FullName string `json:"full_name"`
	}
	if err := decode(r, &req); err != nil || req.IIN == "" {
		respondErr(w, http.StatusBadRequest, "iin required")
		return
	}

	owner := req.FullName
	if owner == "" {
		data, ok := egovData[req.IIN]
		if !ok {
			data = egovData["default"]
		}
		if fn, ok := data["full_name"].(string); ok {
			owner = fn
		}
	}

	n := atomic.AddInt64(&ecpSeq, 1)
	now := time.Now()

	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%d|%d", req.IIN, now.UnixNano(), n)))
	serial := strings.ToUpper(hex.EncodeToString(sum[:16]))

	respond(w, http.StatusOK, map[string]interface{}{
		"signature_id": fmt.Sprintf("ECP-2026-%06d", n),
		"cert_serial":  serial,
		"cert_owner":   owner,
		"cert_issuer":  "НУЦ РК (GOST)",
		"algorithm":    "ГОСТ 34.310-2004",
		"signed_at":    now.Format(time.RFC3339),
		"valid_until":  now.AddDate(1, 0, 0).Format(time.RFC3339),
	})
}
