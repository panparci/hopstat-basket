// Live RBAC audit: login each frozen role, probe REST allow/deny, PUT report to role_audits/latest.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"strings"
	"time"
)

type check struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Want   int    `json:"want"`
	Got    int    `json:"got"`
	Detail string `json:"detail,omitempty"`
}

type roleReport struct {
	Role      string  `json:"role"`
	Status    string  `json:"status"`
	HealthPct int     `json:"healthPct"`
	Pass      int     `json:"pass"`
	Fail      int     `json:"fail"`
	Checks    []check `json:"checks"`
}

type report struct {
	ID        string                `json:"id"`
	Status    string                `json:"status"`
	HealthPct int                   `json:"healthPct"`
	Pass      int                   `json:"pass"`
	Fail      int                   `json:"fail"`
	Total     int                   `json:"total"`
	UpdatedAt string                `json:"updatedAt"`
	Roles     map[string]roleReport `json:"roles"`
	Failures  []check               `json:"failures"`
}

type api struct {
	base string
	http *http.Client
	last map[string]any
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	base := strings.TrimRight(env("ROLEAUDIT_BASE", "https://hoopstats.kognifx.com"), "/")
	adminEmail := env("ROLEAUDIT_ADMIN_EMAIL", "admin@hospital.kognifx.com")
	adminPass := env("ROLEAUDIT_ADMIN_PASS", "")
	userPass := env("ROLEAUDIT_USER_PASS", adminPass)
	if adminPass == "" {
		fmt.Fprintln(os.Stderr, "ROLEAUDIT_ADMIN_PASS required")
		os.Exit(1)
	}
	admin := mustClient(base)
	if err := admin.login(adminEmail, adminPass); err != nil {
		fmt.Fprintln(os.Stderr, "admin login:", err)
		os.Exit(1)
	}

	rep := &report{
		ID:        "latest",
		Status:    "berjalan",
		Roles:     map[string]roleReport{},
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	save := func() {
		score(rep)
		if err := admin.put("role_audits", "latest", rep); err != nil {
			fmt.Fprintln(os.Stderr, "save report:", err)
		}
	}
	save()

	add := func(role string, checks []check) {
		rr := summarize(role, checks)
		rep.Roles[role] = rr
		rep.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		save()
		fmt.Printf("%s %s %d%% (%d pass / %d fail)\n", role, rr.Status, rr.HealthPct, rr.Pass, rr.Fail)
	}

	add("anon", runAnon(base))

	accounts := []struct{ role, email, name string }{
		{"admin", adminEmail, "Admin"},
		{"customer", env("ROLEAUDIT_CUSTOMER_EMAIL", "tester@hospital.kognifx.com"), "Customer Audit"},
		{"statistician", "stat@hospital.kognifx.com", "Stat Audit"},
		{"scout", "scout@hospital.kognifx.com", "Scout Audit"},
		{"coach", "coach@hospital.kognifx.com", "Coach Audit"},
	}
	for _, a := range accounts {
		pass := userPass
		if a.role == "admin" {
			pass = adminPass
		}
		if err := ensureUser(admin, base, a.role, a.email, a.name, pass); err != nil {
			add(a.role, []check{{Name: "ensure-user", OK: false, Detail: err.Error()}})
			continue
		}
		c := mustClient(base)
		if err := c.login(a.email, pass); err != nil {
			add(a.role, []check{{Name: "login", OK: false, Detail: err.Error()}})
			continue
		}
		add(a.role, runRole(c, admin, a.role))
	}

	rep.Status = "selesai"
	save()
	fmt.Printf("TOTAL %s %d%%  GET %s/api/audit/roles\n", rep.Status, rep.HealthPct, base)
	if rep.Fail > 0 {
		os.Exit(1)
	}
}

func runAnon(base string) []check {
	c := mustClient(base)
	var out []check
	out = append(out, c.expect("GET", "/api/health", nil, 200))
	out = append(out, c.expect("GET", "/api/auth/me", nil, 401))
	out = append(out, c.expect("GET", "/api/stores/matches", nil, 401))
	out = append(out, c.expect("GET", "/api/stores/user_accounts", nil, 401))
	out = append(out, c.expect("GET", "/api/stores/site_content", nil, 200))
	out = append(out, c.expect("GET", "/api/audit/roles", nil, 200))
	out = append(out, c.expect("POST", "/api/admin/wipe", map[string]any{}, 401))
	return out
}

func runRole(c, admin *api, role string) []check {
	var out []check
	st, body := c.status("GET", "/api/auth/me", nil)
	out = append(out, okCheck("login-me", st == 200 && roleOf(body) == role, 200, st, fmt.Sprintf("role=%s", roleOf(body))))

	out = append(out, c.expect("GET", "/api/stores/matches", nil, 200))
	out = append(out, c.expect("GET", "/api/stores/profiles", nil, 200))
	out = append(out, c.expect("GET", "/api/stores/site_content", nil, 200))

	ua := c.expect("GET", "/api/stores/user_accounts", nil, 200)
	if ua.OK && role != "admin" {
		n := itemCount(c.last)
		if n != 1 {
			ua.OK = false
			ua.Detail = fmt.Sprintf("want 1 self row, got %d", n)
		}
	}
	out = append(out, ua)

	wantLeads := 403
	if role == "admin" {
		wantLeads = 200
	}
	out = append(out, c.expect("GET", "/api/stores/leads", nil, wantLeads))

	out = append(out, c.expectWrite(admin, role, "matches", canWrite(role, "track_match", "do_stat_tasks", "do_qa_review", "do_coach_analysis")))
	out = append(out, c.expectWrite(admin, role, "events", canWrite(role, "track_match", "do_stat_tasks", "do_qa_review")))
	out = append(out, c.expectWrite(admin, role, "coach_annotations", canWrite(role, "do_coach_analysis")))
	out = append(out, c.expectWrite(admin, role, "profiles", canWrite(role, "manage_profiles", "manage_athletes")))
	out = append(out, c.expectWrite(admin, role, "stat_requests", canWrite(role, "request_stats", "assign_stat_tasks", "do_stat_tasks", "approve_applications")))
	out = append(out, c.expectWrite(admin, role, "leads", canWrite(role, "manage_crm")))
	out = append(out, c.expectWrite(admin, role, "site_content", canWrite(role, "manage_cms")))

	if role != "admin" {
		out = append(out, c.expect("POST", "/api/admin/wipe", map[string]any{}, 403))
		out = append(out, c.expect("PUT", "/api/stores/role_audits/latest", map[string]any{"id": "latest", "hack": true}, 403))
	}

	if role == "customer" || role == "scout" || role == "statistician" || role == "coach" {
		me := map[string]any{}
		if u, _ := body["user"].(map[string]any); u != nil {
			me = u
		}
		id := fmt.Sprint(me["id"])
		me["role"] = "admin"
		st2, after := c.status("PUT", "/api/stores/user_accounts/"+id, me)
		gotRole := ""
		if item, _ := after["item"].(map[string]any); item != nil {
			gotRole = fmt.Sprint(item["role"])
		}
		out = append(out, okCheck("no-self-promote", st2 == 200 && gotRole == role, 200, st2, "role="+gotRole))
	}

	if role == "scout" {
		st3, list := c.status("GET", "/api/stores/matches", nil)
		bad := 0
		if items, _ := list["items"].([]any); st3 == 200 {
			for _, it := range items {
				m, _ := it.(map[string]any)
				if fmt.Sprint(m["productionStage"]) != "published" {
					bad++
				}
			}
		}
		out = append(out, okCheck("scout-published-only", st3 == 200 && bad == 0, 200, st3, fmt.Sprintf("drafts=%d", bad)))
	}
	return out
}

func canWrite(role string, perms ...string) bool {
	if role == "admin" {
		return true
	}
	have := map[string][]string{
		"statistician": {"view_home", "view_matches", "track_match", "do_stat_tasks", "view_own_stats"},
		"customer":     {"view_home", "view_matches", "view_own_stats", "view_published_story", "request_stats", "manage_teams", "manage_profiles"},
		"scout":        {"view_home", "view_gallery", "view_published_story"},
		"coach":        {"view_home", "view_matches", "view_own_stats", "view_published_story", "do_coach_analysis"},
	}[role]
	set := map[string]bool{}
	for _, p := range have {
		set[p] = true
	}
	for _, p := range perms {
		if set[p] {
			return true
		}
	}
	return false
}

func (c *api) expectWrite(admin *api, role, store string, allow bool) check {
	id := "roleaudit-" + role + "-" + store
	doc := map[string]any{"id": id, "name": "roleaudit", "productionStage": "tracking", "customerId": "x", "status": "pending"}
	want := 403
	if allow {
		want = 200
	}
	ch := c.expect("PUT", "/api/stores/"+store+"/"+id, doc, want)
	ch.Name = "write-" + store
	if allow || ch.Got == 200 {
		_, _ = admin.status("DELETE", "/api/stores/"+store+"/"+id, nil)
	}
	return ch
}

func ensureUser(admin *api, base, role, email, name, pass string) error {
	st, list := admin.status("GET", "/api/stores/user_accounts", nil)
	if st != 200 {
		return fmt.Errorf("list users %d", st)
	}
	if items, _ := list["items"].([]any); items != nil {
		for _, it := range items {
			m, _ := it.(map[string]any)
			if !strings.EqualFold(fmt.Sprint(m["email"]), email) {
				continue
			}
			if fmt.Sprint(m["role"]) == role && fmt.Sprint(m["status"]) == "active" {
				return nil
			}
			m["role"] = role
			m["status"] = "active"
			return admin.put("user_accounts", fmt.Sprint(m["id"]), m)
		}
	}
	guest := mustClient(base)
	st, body := guest.status("POST", "/api/auth/register", map[string]any{
		"name": name, "email": email, "password": pass,
	})
	if st != 201 && st != 200 {
		if msg := fmt.Sprint(body["error"]); !strings.Contains(msg, "sudah terdaftar") {
			return fmt.Errorf("register %s: %d %v", email, st, body)
		}
	}
	st, list = admin.status("GET", "/api/stores/user_accounts", nil)
	if st != 200 {
		return fmt.Errorf("list users %d", st)
	}
	if items, _ := list["items"].([]any); items != nil {
		for _, it := range items {
			m, _ := it.(map[string]any)
			if strings.EqualFold(fmt.Sprint(m["email"]), email) {
				m["role"] = role
				m["status"] = "active"
				return admin.put("user_accounts", fmt.Sprint(m["id"]), m)
			}
		}
	}
	return fmt.Errorf("user %s not found after register", email)
}

func mustClient(base string) *api {
	jar, _ := cookiejar.New(nil)
	return &api{base: base, http: &http.Client{Jar: jar, Timeout: 30 * time.Second}}
}

func (c *api) login(email, pass string) error {
	st, body := c.status("POST", "/api/auth/login", map[string]any{"email": email, "password": pass})
	if st != 200 {
		return fmt.Errorf("%d %v", st, body)
	}
	c.last = body
	return nil
}

func (c *api) put(store, id string, doc any) error {
	st, body := c.status("PUT", "/api/stores/"+store+"/"+id, doc)
	if st != 200 {
		return fmt.Errorf("%s/%s %d %v", store, id, st, body)
	}
	return nil
}

func (c *api) status(method, path string, body any) (int, map[string]any) {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+path, rdr)
	if err != nil {
		return 0, map[string]any{"error": err.Error()}
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		return 0, map[string]any{"error": err.Error()}
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	c.last = out
	return res.StatusCode, out
}

func (c *api) expect(method, path string, body any, want int) check {
	got, raw := c.status(method, path, body)
	detail := ""
	if got != want {
		detail = fmt.Sprint(raw["error"])
	}
	return check{Name: method + " " + path, OK: got == want, Want: want, Got: got, Detail: detail}
}

func okCheck(name string, ok bool, want, got int, detail string) check {
	return check{Name: name, OK: ok, Want: want, Got: got, Detail: detail}
}

func roleOf(body map[string]any) string {
	if u, _ := body["user"].(map[string]any); u != nil {
		return fmt.Sprint(u["role"])
	}
	return ""
}

func itemCount(body map[string]any) int {
	if items, ok := body["items"].([]any); ok {
		return len(items)
	}
	return 0
}

func summarize(role string, checks []check) roleReport {
	rr := roleReport{Role: role, Checks: checks}
	for _, ch := range checks {
		if ch.OK {
			rr.Pass++
		} else {
			rr.Fail++
		}
	}
	n := rr.Pass + rr.Fail
	if n > 0 {
		rr.HealthPct = rr.Pass * 100 / n
	}
	if rr.Fail == 0 {
		rr.Status = "sehat"
	} else {
		rr.Status = "ada_bug"
	}
	return rr
}

func score(rep *report) {
	rep.Pass, rep.Fail, rep.Failures = 0, 0, nil
	for _, rr := range rep.Roles {
		rep.Pass += rr.Pass
		rep.Fail += rr.Fail
		for _, ch := range rr.Checks {
			if !ch.OK {
				ch.Name = rr.Role + ": " + ch.Name
				rep.Failures = append(rep.Failures, ch)
			}
		}
	}
	rep.Total = rep.Pass + rep.Fail
	if rep.Total > 0 {
		rep.HealthPct = rep.Pass * 100 / rep.Total
	}
	if rep.Status == "berjalan" {
		return
	}
	if rep.Fail == 0 {
		rep.Status = "sehat"
	} else {
		rep.Status = "ada_bug"
	}
}
