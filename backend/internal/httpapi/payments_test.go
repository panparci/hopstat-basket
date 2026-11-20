package httpapi

import "testing"

func TestMidtransSign(t *testing.T) {
	// Known Midtrans sample shape: sha512(order_id + status_code + gross_amount + server_key)
	got := midtransSign("order-1", "200", "10000.00", "SB-Mid-server-test")
	if len(got) != 128 {
		t.Fatalf("expected sha512 hex length 128, got %d (%s)", len(got), got)
	}
	again := midtransSign("order-1", "200", "10000.00", "SB-Mid-server-test")
	if got != again {
		t.Fatal("signature not stable")
	}
	if midtransSign("order-1", "200", "10000.00", "other") == got {
		t.Fatal("different key must change signature")
	}
}

func TestMidtransDisabledWithoutKey(t *testing.T) {
	if Midtrans("", "client", false).Enabled() {
		t.Fatal("empty server key must disable Midtrans")
	}
	if !Midtrans("SB-Mid-server-x", "client", false).Enabled() {
		t.Fatal("server key should enable Midtrans")
	}
}
