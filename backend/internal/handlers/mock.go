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

// iszRegions mirrors the region options offered on the agro-animal-husbandry
// control-case form (see migrations/011_agroanimal_control.up.sql, field an4) —
// keeps mock ИСЖ farms geographically consistent with what applicants pick.
var iszRegions = []string{
	"Акмолинская", "Актюбинская", "Алматинская", "Атырауская", "Восточно-Казахстанская",
	"Жамбылская", "Западно-Казахстанская", "Карагандинская", "Костанайская", "Кызылординская",
	"Павлодарская", "Северо-Казахстанская", "Туркестанская",
}

var iszFarmNames = []string{
	"КХ «Береке»", "КХ «Жайлау»", "ТОО «Мал Азық Импекс»", "СПК «Ак Мая»",
	"КХ «Тұран»", "ТОО «Агро-Дән»", "КХ «Достык»", "СПК «Шапагат»",
	"КХ «Нұрлы Жол»", "ТОО «Байтерек Агро»",
}

// ISZLivestockEntry is one species row in a mock ИСЖ (Информационная система
// идентификации сельскохозяйственных животных, МСХ РК) farm record.
type ISZLivestockEntry struct {
	Species         string `json:"species"`
	Count           int    `json:"count"`
	IdentifiedCount int    `json:"identified_count"`
	LastUpdate      string `json:"last_update"`
}

// ISZ returns mock livestock-registry data for an IIN/BIN, imitating the
// government ИСЖ database (headcount by species + identification coverage +
// quarantine status). Deterministic from the input so the same applicant
// always sees the same numbers — same convention as EGov/KGD mocks above.
func (h *MockHandler) ISZ(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "iin_or_bin")
	if id == "" {
		respondErr(w, http.StatusBadRequest, "iin or bin required")
		return
	}

	digitSum := 0
	for _, c := range id {
		if c >= '0' && c <= '9' {
			digitSum += int(c - '0')
		}
	}
	last := int(id[len(id)-1] - '0')
	if last < 0 || last > 9 {
		last = digitSum % 10
	}

	region := iszRegions[digitSum%len(iszRegions)]
	farmName := iszFarmNames[digitSum%len(iszFarmNames)]

	baseHeads := 60 + (digitSum%12)*15 // ~60..225 head, plausible mid-size farm
	// Share of headcount not yet identified in ИСЖ — small realistic gap (2%..16%).
	missing := 0.02 + float64(last)*0.014

	addLivestock := func(list []ISZLivestockEntry, species string, count int, missingRate float64) []ISZLivestockEntry {
		identified := count - int(float64(count)*missingRate)
		if identified < 0 {
			identified = 0
		}
		if identified > count {
			identified = count
		}
		month := 1 + digitSum%6
		day := 3 + digitSum%25
		return append(list, ISZLivestockEntry{
			Species:         species,
			Count:           count,
			IdentifiedCount: identified,
			LastUpdate:      fmt.Sprintf("2026-%02d-%02d", month, day),
		})
	}

	// КРС и МРС присутствуют у КАЖДОЙ фермы — это самые вероятные заявляемые
	// виды в контрольной агро-услуге (поле an6), сверка на демо не должна
	// упираться в «вид не отслеживается». Остальные виды варьируются.
	var livestock []ISZLivestockEntry
	livestock = addLivestock(livestock, "КРС", baseHeads, missing)
	livestock = addLivestock(livestock, "МРС", baseHeads*3/2, missing*0.8)
	switch last % 3 {
	case 1:
		livestock = addLivestock(livestock, "Птица", baseHeads*20, missing*1.2)
	case 2:
		livestock = addLivestock(livestock, "Лошади", baseHeads/4+5, missing*0.6)
	}
	if digitSum%7 == 0 {
		livestock = addLivestock(livestock, "Верблюды", 8+digitSum%10, missing*0.5)
	}

	totalIdentified := 0
	for _, l := range livestock {
		totalIdentified += l.IdentifiedCount
	}

	// Rare, deterministic active-quarantine flag: only IDs ending in "7777".
	// Seed accounts stay clean by construction: admin 000000000000 and the
	// synthetic users from migrations 005/012/015 (IINs 100000000001..100000003000)
	// have last-4 digits in 0001..3000 — never 7777.
	// Demo IIN for the negative (quarantine) scenario: 100000007777.
	hasQuarantine := strings.HasSuffix(id, "7777")

	respond(w, http.StatusOK, map[string]interface{}{
		"iin_bin":               id,
		"farm_name":             farmName,
		"region":                region,
		"livestock":             livestock,
		"total_identified":      totalIdentified,
		"has_active_quarantine": hasQuarantine,
		"data_source":           "mock ИСЖ МСХ РК",
		"fetched_at":            time.Now().Format(time.RFC3339),
	})
}

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
