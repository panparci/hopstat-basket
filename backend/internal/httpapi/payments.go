package httpapi

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Midtrans sits on top of store "payments" (DP-11 / DP-12 / DP-16).
// Without MIDTRANS_SERVER_KEY the existing admin-confirm path stays the only way to mark success.

type midtransCfg struct {
	ServerKey  string
	ClientKey  string
	Production bool
}

// Midtrans builds the optional Snap/webhook config. Empty server key = admin-confirm only.
func Midtrans(serverKey, clientKey string, production bool) midtransCfg {
	return midtransCfg{ServerKey: strings.TrimSpace(serverKey), ClientKey: strings.TrimSpace(clientKey), Production: production}
}

func (m midtransCfg) Enabled() bool { return m.enabled() }

func (m midtransCfg) enabled() bool {
	return strings.TrimSpace(m.ServerKey) != ""
}

func (m midtransCfg) snapURL() string {
	if m.Production {
		return "https://app.midtrans.com/snap/v1/transactions"
	}
	return "https://app.sandbox.midtrans.com/snap/v1/transactions"
}

func midtransSign(orderID, statusCode, grossAmount, serverKey string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	return hex.EncodeToString(sum[:])
}

func paymentAmount(doc map[string]any) int64 {
	switch v := doc["amount"].(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case json.Number:
		n, _ := v.Int64()
		return n
	case string:
		n, _ := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
		return n
	default:
		return 0
	}
}

// GET /api/payments/gateway — whether Snap is live (no secrets).
func (s *Server) paymentGateway(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"midtrans":   s.midtrans.enabled(),
		"production": s.midtrans.Production,
	})
}

// POST /api/payments/{id}/charge — Snap token for an existing pending payment owned by the caller.
func (s *Server) chargePayment(w http.ResponseWriter, r *http.Request) {
	if !s.midtrans.enabled() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "midtrans_not_configured",
			"hint":  "Set MIDTRANS_SERVER_KEY + MIDTRANS_CLIENT_KEY, or keep admin confirm on payments.",
		})
		return
	}
	u := userFrom(r)
	id := r.PathValue("id")
	pay, err := s.getDoc(r.Context(), "payments", id)
	if err != nil || pay == nil {
		writeErr(w, http.StatusNotFound, fmt.Errorf("payment not found"))
		return
	}
	if err := s.authorizeWrite(r.Context(), u, "payments", pay, pay); err != nil {
		writeErr(w, http.StatusForbidden, errForbidden)
		return
	}
	if asString(pay["status"]) == "success" {
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "id": id})
		return
	}
	amt := paymentAmount(pay)
	if amt <= 0 {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("payment amount required"))
		return
	}
	body, _ := json.Marshal(map[string]any{
		"transaction_details": map[string]any{
			"order_id":     id,
			"gross_amount": amt,
		},
		"credit_card": map[string]any{"secure": true},
	})
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, s.midtrans.snapURL(), bytes.NewReader(body))
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(s.midtrans.ServerKey+":")))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err)
		return
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": "midtrans_snap_failed", "detail": json.RawMessage(raw)})
		return
	}
	var snap struct {
		Token       string `json:"token"`
		RedirectURL string `json:"redirect_url"`
	}
	if err := json.Unmarshal(raw, &snap); err != nil || snap.Token == "" {
		writeErr(w, http.StatusBadGateway, fmt.Errorf("midtrans snap response invalid"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token":        snap.Token,
		"redirect_url": snap.RedirectURL,
		"client_key":   s.midtrans.ClientKey,
		"payment_id":   id,
	})
}

// POST /api/payments/midtrans/notification — Midtrans webhook; marks payment success/failure only.
func (s *Server) midtransNotification(w http.ResponseWriter, r *http.Request) {
	if !s.midtrans.enabled() {
		writeErr(w, http.StatusServiceUnavailable, fmt.Errorf("midtrans_not_configured"))
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var n struct {
		OrderID           string `json:"order_id"`
		StatusCode        string `json:"status_code"`
		GrossAmount       string `json:"gross_amount"`
		SignatureKey      string `json:"signature_key"`
		TransactionStatus string `json:"transaction_status"`
		FraudStatus       string `json:"fraud_status"`
	}
	if err := json.Unmarshal(raw, &n); err != nil || n.OrderID == "" {
		writeErr(w, http.StatusBadRequest, fmt.Errorf("invalid notification"))
		return
	}
	if !strings.EqualFold(n.SignatureKey, midtransSign(n.OrderID, n.StatusCode, n.GrossAmount, s.midtrans.ServerKey)) {
		writeErr(w, http.StatusForbidden, fmt.Errorf("bad signature"))
		return
	}
	pay, err := s.getDoc(r.Context(), "payments", n.OrderID)
	if err != nil || pay == nil {
		writeErr(w, http.StatusNotFound, fmt.Errorf("payment not found"))
		return
	}
	status := asString(pay["status"])
	switch n.TransactionStatus {
	case "capture", "settlement":
		if n.FraudStatus == "" || n.FraudStatus == "accept" {
			status = "success"
		}
	case "pending":
		status = "pending"
	case "deny", "cancel", "expire", "failure":
		status = "failed"
	}
	pay["status"] = status
	pay["midtransStatus"] = n.TransactionStatus
	pay["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
	if _, err := s.putDoc(r.Context(), s.pool, "payments", pay); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	// DP-11: if this payment targets a claim, mirror paymentStatus (admin review still required).
	if rid := asString(pay["requestId"]); rid != "" {
		if claim, _ := s.getDoc(r.Context(), "claim_requests", rid); claim != nil {
			if status == "success" {
				claim["paymentStatus"] = "paid"
				claim["paymentId"] = n.OrderID
			} else if status == "failed" {
				claim["paymentStatus"] = "failed"
			}
			_, _ = s.putDoc(r.Context(), s.pool, "claim_requests", claim)
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}
