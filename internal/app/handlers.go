package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
	"net/url"

	"golang.org/x/crypto/bcrypt"

	"netplug-go/internal/db"
	"netplug-go/internal/view"
	"netplug-go/internal/wireguard"

	"github.com/go-chi/chi/v5"
)

type Handlers struct {
	svc *Services
}

func NewHandlers(svc *Services) *Handlers {
	return &Handlers{svc: svc}
}

func (h *Handlers) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !h.isSetupComplete() && r.URL.Path != "/setup" && !strings.HasPrefix(r.URL.Path, "/setup/") {
			http.Redirect(w, r, "/setup", http.StatusFound)
			return
		}
		userID := h.svc.Sessions.GetString(r.Context(), "user_id")
		if userID == "" {
			http.Redirect(w, r, "/login", http.StatusFound)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handlers) isSetupComplete() bool {
	cfg, err := db.GetSystemConfig(h.svc.DB)
	if err != nil {
		return false
	}
	return cfg.IsSetupComplete
}

func (h *Handlers) LoginPage(w http.ResponseWriter, r *http.Request) {
	if !h.isSetupComplete() {
		http.Redirect(w, r, "/setup", http.StatusFound)
		return
	}
	view.Render(w, r, "login.tmpl", view.M{
		"Title": "Login",
	})
}

func (h *Handlers) LoginPost(w http.ResponseWriter, r *http.Request) {
	if !h.isSetupComplete() {
		http.Redirect(w, r, "/setup", http.StatusFound)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(r.FormValue("username"))
	password := r.FormValue("password")
	if username == "" || password == "" {
		view.Render(w, r, "login.tmpl", view.M{
			"Title": "Login",
			"Error": "Username and password are required.",
		})
		return
	}

	var (
		id       string
		hash     string
	)
	err := h.svc.DB.QueryRow(`SELECT id, password FROM users WHERE username = ? LIMIT 1`, username).Scan(&id, &hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			view.Render(w, r, "login.tmpl", view.M{
				"Title": "Login",
				"Error": "Invalid credentials.",
			})
			return
		}
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		view.Render(w, r, "login.tmpl", view.M{
			"Title": "Login",
			"Error": "Invalid credentials.",
		})
		return
	}

	h.svc.Sessions.Put(r.Context(), "user_id", id)
	http.Redirect(w, r, "/dashboard", http.StatusFound)
}

func (h *Handlers) SetupPage(w http.ResponseWriter, r *http.Request) {
	// If already setup, go to dashboard/login.
	if h.isSetupComplete() {
		if h.svc.Sessions.GetString(r.Context(), "user_id") != "" {
			http.Redirect(w, r, "/dashboard", http.StatusFound)
			return
		}
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}

	var userCount int
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&userCount)

	cfg, _ := db.GetSystemConfig(h.svc.DB)
	view.Render(w, r, "setup.tmpl", view.M{
		"Title":     "Setup",
		"HasAdmin":  userCount > 0,
		"VPNConfig": string(cfg.VPNConfigJSON),
	})
}

func (h *Handlers) SetupGenerateKeysPartial(w http.ResponseWriter, r *http.Request) {
	priv, pub, err := wireguard.GenerateKeyPair()
	if err != nil {
		http.Error(w, "key generation failed", http.StatusInternalServerError)
		return
	}
	view.RenderPartial(w, r, "partials/setup_keys.tmpl", view.M{
		"PrivateKey": priv,
		"PublicKey":  pub,
	})
}

func (h *Handlers) SetupAdminPost(w http.ResponseWriter, r *http.Request) {
	if h.isSetupComplete() {
		http.Redirect(w, r, "/login", http.StatusFound)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(r.FormValue("username"))
	password := r.FormValue("password")
	confirm := r.FormValue("confirm_password")
	if username == "" || password == "" || confirm == "" || password != confirm {
		http.Redirect(w, r, "/setup", http.StatusFound)
		return
	}

	var existing int
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&existing)
	if existing > 0 {
		http.Redirect(w, r, "/setup", http.StatusFound)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	id := uuidString()
	_, err = h.svc.DB.Exec(`INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, 'admin')`, id, username, string(hash))
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	h.svc.Sessions.Put(r.Context(), "user_id", id)
	http.Redirect(w, r, "/setup", http.StatusFound)
}

func (h *Handlers) SetupWireGuardPost(w http.ResponseWriter, r *http.Request) {
	if h.isSetupComplete() {
		http.Redirect(w, r, "/dashboard", http.StatusFound)
		return
	}
	if h.svc.Sessions.GetString(r.Context(), "user_id") == "" {
		http.Redirect(w, r, "/setup", http.StatusFound)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}

	cfg := wireguard.SetupConfig{
		ServerHost:          strings.TrimSpace(r.FormValue("server_host")),
		ServerPort:          mustAtoi(r.FormValue("server_port"), 51820),
		ServerAddress:       strings.TrimSpace(r.FormValue("server_address")),
		ClientAddressRange:  strings.TrimSpace(r.FormValue("client_address_range")),
		DNS:                 strings.TrimSpace(r.FormValue("dns")),
		MTU:                 mustAtoi(r.FormValue("mtu"), 1420),
		PersistentKeepalive: mustAtoi(r.FormValue("persistent_keepalive"), 25),
		AllowedIPs:          strings.TrimSpace(r.FormValue("allowed_ips")),
		PreUp:               r.FormValue("pre_up"),
		PostUp:              r.FormValue("post_up"),
		PreDown:             r.FormValue("pre_down"),
		PostDown:            r.FormValue("post_down"),
		PrivateKey:          strings.TrimSpace(r.FormValue("private_key")),
		PublicKey:           strings.TrimSpace(r.FormValue("public_key")),
	}
	if cfg.DNS == "" {
		cfg.DNS = "1.1.1.1, 1.0.0.1"
	}
	if cfg.AllowedIPs == "" {
		cfg.AllowedIPs = "0.0.0.0/0, ::/0"
	}

	if err := wireguard.ValidateSetupConfig(cfg); err != nil {
		view.Render(w, r, "setup.tmpl", view.M{
			"Title":    "Setup",
			"HasAdmin": true,
			"Error":    err.Error(),
			"Prefill":  cfg,
		})
		return
	}

	vpnCfg := map[string]any{
		"wireGuard": map[string]any{
			"enabled":            true,
			"serverHost":         cfg.ServerHost,
			"serverPort":         cfg.ServerPort,
			"serverAddress":      cfg.ServerAddress,
			"clientAddressRange": cfg.ClientAddressRange,
			"dns":                cfg.DNS,
			"mtu":                cfg.MTU,
			"persistentKeepalive": cfg.PersistentKeepalive,
			"allowedIps":         cfg.AllowedIPs,
			"preUp":              cfg.PreUp,
			"postUp":             cfg.PostUp,
			"preDown":            cfg.PreDown,
			"postDown":           cfg.PostDown,
		},
	}
	if err := db.UpsertSystemConfig(h.svc.DB, true, vpnCfg); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	if err := wireguard.UpsertWireGuardServer(h.svc.DB, h.svc.Config.DataDir, cfg); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if err := wireguard.WriteWireGuardConfig(h.svc.DB, h.svc.Config.DataDir); err != nil {
		http.Error(w, "failed to write wg0.conf", http.StatusInternalServerError)
		return
	}
	_ = wireguard.ApplyConfig(h.svc.Config.DataDir, h.svc.Config.WGInterface)

	http.Redirect(w, r, "/dashboard", http.StatusFound)
}

func mustAtoi(s string, fallback int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return fallback
	}
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func uuidString() string {
	return wireguard.NewID()
}

func (h *Handlers) LogoutPost(w http.ResponseWriter, r *http.Request) {
	_ = h.svc.Sessions.Destroy(r.Context())
	http.Redirect(w, r, "/login", http.StatusFound)
}

func (h *Handlers) DashboardPage(w http.ResponseWriter, r *http.Request) {
	view.Render(w, r, "dashboard.tmpl", view.M{
		"Title": "Dashboard",
		"Now":   time.Now(),
	})
}

func (h *Handlers) OverviewAllPartial(w http.ResponseWriter, r *http.Request) {
	type connStats struct {
		InUse        int
		Available    int
		Total        int
		Mid          int
		InUsePct     int
		AvailablePct int
	}
	type xferStats struct {
		Received int64
		Sent     int64
		Combined int64
	}
	type sysInfo struct {
		ServerAddress string
		Version       string
		OSName        string
		Hostname      string
		UptimeHuman   string
		AcceptingOn   string
		Ports         string
	}

	var (
		total, enabled, connected int
	)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users WHERE server_id='wireguard'`).Scan(&total)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users WHERE server_id='wireguard' AND is_enabled=1`).Scan(&enabled)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users WHERE server_id='wireguard' AND is_enabled=1 AND is_connected=1`).Scan(&connected)

	inUse := connected
	available := maxInt(0, enabled-inUse)
	cs := connStats{
		InUse:     inUse,
		Available: available,
		Total:     total,
		Mid:       total / 2,
	}
	if total > 0 {
		cs.InUsePct = int(float64(inUse) / float64(total) * 100)
		cs.AvailablePct = int(float64(available) / float64(total) * 100)
	}

	var rx, tx int64
	// total_bytes_* are cumulative; bytes_* are current counters. Sum both for an "all time-ish" number.
	_ = h.svc.DB.QueryRow(`SELECT COALESCE(SUM(total_bytes_received + bytes_received),0), COALESCE(SUM(total_bytes_sent + bytes_sent),0) FROM vpn_users WHERE server_id='wireguard'`).Scan(&rx, &tx)
	xf := xferStats{Received: rx, Sent: tx, Combined: rx + tx}

	hn, _ := os.Hostname()
	uptime := time.Since(h.svc.StartedAt)
	si := sysInfo{
		ServerAddress: h.svc.Config.HTTPAddr,
		Version:       "go-htmx",
		OSName:        runtime.GOOS,
		Hostname:      hn,
		UptimeHuman:   humanUptime(uptime),
		AcceptingOn:   h.svc.Config.WGInterface,
		Ports:         strconv.Itoa(wireguardPort(h.svc.DB)),
	}

	view.RenderPartial(w, r, "partials/overview_all.tmpl", view.M{
		"Conn": cs,
		"Xfer": xf,
		"Sys":  si,
	})
}

func wireguardPort(dbConn *sql.DB) int {
	var p sql.NullInt64
	_ = dbConn.QueryRow(`SELECT port FROM vpn_servers WHERE id='wireguard' LIMIT 1`).Scan(&p)
	if p.Valid {
		return int(p.Int64)
	}
	return 51820
}

func humanUptime(d time.Duration) string {
	sec := int(d.Seconds())
	days := sec / 86400
	hours := (sec % 86400) / 3600
	mins := (sec % 3600) / 60
	var parts []string
	if days > 0 {
		parts = append(parts, plural(days, "day"))
	}
	if hours > 0 {
		parts = append(parts, plural(hours, "hour"))
	}
	if mins > 0 {
		parts = append(parts, plural(mins, "minute"))
	}
	if len(parts) == 0 {
		return "Less than a minute"
	}
	if len(parts) == 1 {
		return parts[0]
	}
	if len(parts) == 2 {
		return parts[0] + ", " + parts[1]
	}
	return parts[0] + ", " + parts[1] + ", " + parts[2]
}

func plural(n int, unit string) string {
	if n == 1 {
		return "1 " + unit
	}
	return strconv.Itoa(n) + " " + unit + "s"
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (h *Handlers) UsersPage(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.DB.Query(`
		SELECT
			id,
			username,
			allowed_ips,
			endpoint,
			is_enabled,
			is_connected,
			bytes_received,
			bytes_sent,
			total_bytes_received,
			total_bytes_sent,
			remaining_days,
			remaining_traffic_bytes,
			connected_at,
			peer_icon
		FROM vpn_users
		ORDER BY username ASC
		LIMIT 500
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type userRow struct {
		ID                   string
		Username             string
		IPAddress            string
		Endpoint             string
		IsEnabled            bool
		IsConnected          bool
		TotalRxBytes         int64
		TotalTxBytes         int64
		RemainingDaysValue     int64
		HasRemainingDays       bool
		RemainingTrafficBytes  int64
		HasRemainingTraffic    bool
		ConnectedAt          string
		PeerIcon             string
	}
	var users []userRow
	for rows.Next() {
		var u userRow
		var enabled, connected int
		var connectedAt sql.NullString
		var allowedIPs sql.NullString
		var endpoint sql.NullString
		var remainingDays sql.NullInt64
		var remainingTraffic sql.NullInt64
		var peerIcon sql.NullString
		var bytesRx, bytesTx, totalBytesRx, totalBytesTx int64
		if err := rows.Scan(
			&u.ID,
			&u.Username,
			&allowedIPs,
			&endpoint,
			&enabled,
			&connected,
			&bytesRx,
			&bytesTx,
			&totalBytesRx,
			&totalBytesTx,
			&remainingDays,
			&remainingTraffic,
			&connectedAt,
			&peerIcon,
		); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		u.TotalRxBytes = totalBytesRx + bytesRx
		u.TotalTxBytes = totalBytesTx + bytesTx
		u.IsEnabled = enabled != 0
		u.IsConnected = connected != 0
		if connectedAt.Valid {
			u.ConnectedAt = connectedAt.String
		}
		if allowedIPs.Valid {
			// First IP/CIDR is the peer tunnel address.
			first := strings.TrimSpace(allowedIPs.String)
			if i := strings.IndexByte(first, ','); i >= 0 {
				first = strings.TrimSpace(first[:i])
			}
			u.IPAddress = first
		}
		if endpoint.Valid {
			u.Endpoint = endpoint.String
		}
		if remainingDays.Valid {
			u.HasRemainingDays = true
			u.RemainingDaysValue = remainingDays.Int64
		}
		if remainingTraffic.Valid {
			u.HasRemainingTraffic = true
			u.RemainingTrafficBytes = remainingTraffic.Int64
		}
		if peerIcon.Valid {
			u.PeerIcon = peerIcon.String
		}
		users = append(users, u)
	}

	view.Render(w, r, "users.tmpl", view.M{
		"Title": "Users",
		"Users": users,
	})
}

func (h *Handlers) UserCreatePost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	username := strings.TrimSpace(r.FormValue("username"))
	if username == "" {
		http.Redirect(w, r, "/dashboard/users", http.StatusFound)
		return
	}

	vpnIP := strings.TrimSpace(r.FormValue("vpn_ip"))
	if vpnIP == "" {
		vpnIP = strings.TrimSpace(r.FormValue("allowed_ips"))
	}
	if vpnIP == "" {
		alloc, err := wireguard.NextClientAllowedIP(h.svc.DB)
		if err != nil {
			http.Error(w, "ip allocation failed", http.StatusInternalServerError)
			return
		}
		vpnIP = alloc
	}
	extraAllowed := strings.TrimSpace(r.FormValue("allowed_ips_extra"))
	allowedIPs := vpnIP
	if extraAllowed != "" {
		allowedIPs = vpnIP + ", " + extraAllowed
	}

	privateKey := strings.TrimSpace(r.FormValue("private_key"))
	publicKey := strings.TrimSpace(r.FormValue("public_key"))
	psk := strings.TrimSpace(r.FormValue("preshared_key"))

	if privateKey == "" {
		priv, pub, err := wireguard.GenerateKeyPair()
		if err != nil {
			http.Error(w, "key generation failed", http.StatusInternalServerError)
			return
		}
		privateKey = priv
		publicKey = pub
	} else if publicKey == "" {
		pub, err := wireguard.DerivePublicKey(privateKey)
		if err != nil {
			http.Error(w, "invalid private key", http.StatusBadRequest)
			return
		}
		publicKey = pub
	}
	// PSK is optional: only store it if provided/generated by the user.

	var remainingDays any = nil
	if v := strings.TrimSpace(r.FormValue("remaining_days")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			remainingDays = n
		}
	}
	var remainingTrafficBytes any = nil
	if v := strings.TrimSpace(r.FormValue("remaining_traffic_mb")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			const bytesPerMB = 1024 * 1024
			remainingTrafficBytes = n * bytesPerMB
		}
	}
	isEnabled := 1
	if strings.TrimSpace(r.FormValue("is_enabled")) == "" {
		isEnabled = 0
	}

	id := wireguard.NewID()
	_, err := h.svc.DB.Exec(`
		INSERT INTO vpn_users (
		  id, username, allowed_ips, private_key, public_key, preshared_key,
		  remaining_days, remaining_traffic_bytes,
		  server_id, is_enabled
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'wireguard', ?)
	`, id, username, allowedIPs, privateKey, publicKey, nullIfEmpty(psk), remainingDays, remainingTrafficBytes, isEnabled)
	if err != nil {
		http.Error(w, "create failed", http.StatusInternalServerError)
		return
	}

	_ = wireguard.WriteWireGuardConfig(h.svc.DB, h.svc.Config.DataDir)
	_ = wireguard.ApplyConfig(h.svc.Config.DataDir, h.svc.Config.WGInterface)

	http.Redirect(w, r, "/dashboard/users", http.StatusFound)
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (h *Handlers) AddUserModalPartial(w http.ResponseWriter, r *http.Request) {
	nextIP, _ := wireguard.NextClientAllowedIP(h.svc.DB)
	view.RenderPartial(w, r, "partials/add_user_modal.tmpl", view.M{
		"NextIP": nextIP,
	})
}

func (h *Handlers) EditUserModalPartial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	var (
		username         string
		privateKey       sql.NullString
		publicKey        sql.NullString
		presharedKey     sql.NullString
		allowed          sql.NullString
		remainingDays    sql.NullInt64
		remainingTraffic sql.NullInt64
		isEnabled        int
	)
	err := h.svc.DB.QueryRow(`
		SELECT username, private_key, public_key, preshared_key, allowed_ips, remaining_days, remaining_traffic_bytes, is_enabled
		FROM vpn_users
		WHERE id = ?
		LIMIT 1
	`, id).Scan(&username, &privateKey, &publicKey, &presharedKey, &allowed, &remainingDays, &remainingTraffic, &isEnabled)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	var vpnIP, allowedExtra string
	if allowed.Valid {
		raw := strings.TrimSpace(allowed.String)
		if i := strings.IndexByte(raw, ','); i >= 0 {
			vpnIP = strings.TrimSpace(raw[:i])
			allowedExtra = strings.TrimSpace(raw[i+1:])
		} else {
			vpnIP = raw
		}
	}
	remainingTrafficMB := ""
	if remainingTraffic.Valid && remainingTraffic.Int64 >= 0 {
		remainingTrafficMB = strconv.FormatInt(remainingTraffic.Int64/(1024*1024), 10)
	}
	remainingDaysStr := ""
	if remainingDays.Valid && remainingDays.Int64 >= 0 {
		remainingDaysStr = strconv.FormatInt(remainingDays.Int64, 10)
	}

	view.RenderPartial(w, r, "partials/edit_user_modal.tmpl", view.M{
		"UserID":            id,
		"Username":          username,
		"PrivateKey":        strings.TrimSpace(privateKey.String),
		"PublicKey":         strings.TrimSpace(publicKey.String),
		"PresharedKey":      strings.TrimSpace(presharedKey.String),
		"VPNIP":             vpnIP,
		"AllowedExtra":      allowedExtra,
		"RemainingDays":     remainingDaysStr,
		"RemainingTrafficMB": remainingTrafficMB,
		"IsEnabled":         isEnabled != 0,
	})
}

func (h *Handlers) UserUpdatePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"Invalid form submission."}}`)
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(r.FormValue("username"))
	if username == "" {
		w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"Username is required."}}`)
		http.Error(w, "username required", http.StatusBadRequest)
		return
	}

	var (
		existingAllowed sql.NullString
		existingPriv    sql.NullString
		existingPSK     sql.NullString
	)
	err := h.svc.DB.QueryRow(`SELECT allowed_ips, private_key, preshared_key FROM vpn_users WHERE id = ? LIMIT 1`, id).Scan(&existingAllowed, &existingPriv, &existingPSK)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	vpnIP := ""
	if existingAllowed.Valid {
		raw := strings.TrimSpace(existingAllowed.String)
		if i := strings.IndexByte(raw, ','); i >= 0 {
			vpnIP = strings.TrimSpace(raw[:i])
		} else {
			vpnIP = raw
		}
	}

	allowedExtra := strings.TrimSpace(r.FormValue("allowed_ips_extra"))
	allowedIPs := strings.TrimSpace(vpnIP)
	if allowedIPs != "" && allowedExtra != "" {
		allowedIPs = allowedIPs + ", " + allowedExtra
	} else if allowedIPs == "" {
		allowedIPs = allowedExtra
	}

	var remainingDays any = nil
	if v := strings.TrimSpace(r.FormValue("remaining_days")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			remainingDays = n
		}
	}

	var remainingTrafficBytes any = nil
	if v := strings.TrimSpace(r.FormValue("remaining_traffic_mb")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n >= 0 {
			remainingTrafficBytes = n * 1024 * 1024
		}
	}

	isEnabled := 0
	if r.FormValue("is_enabled") == "on" {
		isEnabled = 1
	}

	// Allow setting keys only if they were not previously set (parity with original UI behavior).
	privateKey := strings.TrimSpace(r.FormValue("private_key"))
	publicKey := strings.TrimSpace(r.FormValue("public_key"))
	psk := strings.TrimSpace(r.FormValue("preshared_key"))

	updatePriv := any(nil)
	updatePub := any(nil)
	updatePSK := any(nil)

	if !existingPriv.Valid || strings.TrimSpace(existingPriv.String) == "" {
		if privateKey != "" {
			if publicKey == "" {
				pub, err := wireguard.DerivePublicKey(privateKey)
				if err != nil {
					w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"Invalid private key."}}`)
					http.Error(w, "invalid private key", http.StatusBadRequest)
					return
				}
				publicKey = pub
			}
			updatePriv = privateKey
			updatePub = publicKey
		}
	}
	if !existingPSK.Valid || strings.TrimSpace(existingPSK.String) == "" {
		if psk != "" {
			updatePSK = psk
		}
	}

	_, err = h.svc.DB.Exec(`
		UPDATE vpn_users
		SET username = ?,
		    allowed_ips = ?,
		    remaining_days = ?,
		    remaining_traffic_bytes = ?,
		    is_enabled = ?,
		    private_key = COALESCE(?, private_key),
		    public_key = COALESCE(?, public_key),
		    preshared_key = COALESCE(?, preshared_key),
		    updated_at = datetime('now')
		WHERE id = ?
	`, username, nullIfEmpty(allowedIPs), remainingDays, remainingTrafficBytes, isEnabled, updatePriv, updatePub, updatePSK, id)
	if err != nil {
		w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"Failed to save changes."}}`)
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	_ = wireguard.WriteWireGuardConfig(h.svc.DB, h.svc.Config.DataDir)
	_ = wireguard.ApplyConfig(h.svc.Config.DataDir, h.svc.Config.WGInterface)

	// Close modal and show a toast; then refresh list.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("HX-Trigger", `{"toast":{"type":"success","message":"Changes saved."},"usersReload":true}`)
	_, _ = w.Write([]byte(""))
}

func (h *Handlers) UserDeleteModalPartial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	var username string
	err := h.svc.DB.QueryRow(`SELECT username FROM vpn_users WHERE id = ? LIMIT 1`, id).Scan(&username)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	view.RenderPartial(w, r, "partials/delete_user_modal.tmpl", view.M{
		"UserID":   id,
		"Username": username,
	})
}

func (h *Handlers) UserDeletePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	var username string
	_ = h.svc.DB.QueryRow(`SELECT username FROM vpn_users WHERE id = ? LIMIT 1`, id).Scan(&username)

	res, err := h.svc.DB.Exec(`DELETE FROM vpn_users WHERE id = ?`, id)
	if err != nil {
		w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"Failed to delete user."}}`)
		http.Error(w, "delete failed", http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		w.Header().Set("HX-Trigger", `{"toast":{"type":"danger","message":"User not found."}}`)
		http.NotFound(w, r)
		return
	}

	_ = wireguard.WriteWireGuardConfig(h.svc.DB, h.svc.Config.DataDir)
	_ = wireguard.ApplyConfig(h.svc.Config.DataDir, h.svc.Config.WGInterface)

	msg := "User deleted."
	if strings.TrimSpace(username) != "" {
		msg = `User "` + username + `" deleted.`
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("HX-Trigger", `{"toast":{"type":"success","message":`+strconv.Quote(msg)+`},"usersReload":true}`)
	_, _ = w.Write([]byte(""))
}

func (h *Handlers) UserConfigAPIGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	conf, filename, err := wireguard.RenderClientConfig(h.svc.DB, id)
	if err != nil {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"configText": conf,
		"fileName":   filename,
	})
}

func (h *Handlers) UserQRModalPartial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	conf, filename, err := wireguard.RenderClientConfig(h.svc.DB, id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	var (
		username   string
		allowed    sql.NullString
	)
	_ = h.svc.DB.QueryRow(`SELECT username, allowed_ips FROM vpn_users WHERE id = ? LIMIT 1`, id).Scan(&username, &allowed)
	ip := ""
	if allowed.Valid {
		raw := strings.TrimSpace(allowed.String)
		if i := strings.IndexByte(raw, ','); i >= 0 {
			ip = strings.TrimSpace(raw[:i])
		} else {
			ip = raw
		}
	}

	var (
		serverName string
		protocol   string
	)
	_ = h.svc.DB.QueryRow(`SELECT name, protocol FROM vpn_servers WHERE id='wireguard' LIMIT 1`).Scan(&serverName, &protocol)
	if strings.TrimSpace(serverName) == "" {
		serverName = "WireGuard Server"
	}
	if strings.TrimSpace(protocol) == "" {
		protocol = "wireguard"
	}

	view.RenderPartial(w, r, "partials/qr_modal.tmpl", view.M{
		"UserID":    id,
		"Username":  username,
		"Server":    serverName,
		"Protocol":  strings.ToUpper(protocol),
		"IP":        ip,
		"FileName":  filename,
		"ConfigText": conf,
	})
}

func (h *Handlers) EmptyPartial(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(""))
}

func (h *Handlers) UsersGenerateKeysAPI(w http.ResponseWriter, r *http.Request) {
	priv, pub, err := wireguard.GenerateKeyPair()
	if err != nil {
		http.Error(w, `{"error":"failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"privateKey": priv, "publicKey": pub})
}

func (h *Handlers) UsersDerivePublicKeyAPI(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		PrivateKey string `json:"privateKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"bad json"}`, http.StatusBadRequest)
		return
	}
	pub, err := wireguard.DerivePublicKey(payload.PrivateKey)
	if err != nil {
		http.Error(w, `{"error":"invalid key"}`, http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"publicKey": pub})
}

func (h *Handlers) UsersGeneratePSKAPI(w http.ResponseWriter, r *http.Request) {
	psk, err := wireguard.GeneratePresharedKey()
	if err != nil {
		http.Error(w, `{"error":"failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"presharedKey": psk})
}

func (h *Handlers) UsersNextIPAPI(w http.ResponseWriter, r *http.Request) {
	ip, err := wireguard.NextClientAllowedIP(h.svc.DB)
	if err != nil {
		http.Error(w, `{"error":"failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{"allowedIps": ip})
}

func (h *Handlers) UserTogglePost(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Redirect(w, r, "/dashboard/users", http.StatusFound)
		return
	}
	_, err := h.svc.DB.Exec(`
		UPDATE vpn_users
		SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END,
		    updated_at = datetime('now')
		WHERE id = ?
	`, id)
	if err != nil {
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}
	_ = wireguard.WriteWireGuardConfig(h.svc.DB, h.svc.Config.DataDir)
	_ = wireguard.ApplyConfig(h.svc.Config.DataDir, h.svc.Config.WGInterface)

	http.Redirect(w, r, "/dashboard/users", http.StatusFound)
}

func (h *Handlers) UserConfigGet(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.NotFound(w, r)
		return
	}
	conf, filename, err := wireguard.RenderClientConfig(h.svc.DB, id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	_, _ = w.Write([]byte(conf))
}

func (h *Handlers) ConnectionsPage(w http.ResponseWriter, r *http.Request) {
	view.Render(w, r, "connections.tmpl", view.M{
		"Title": "Connections",
	})
}

func (h *Handlers) ServersPage(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.DB.Query(`
		SELECT id, name, protocol, host, port, is_active
		FROM vpn_servers
		ORDER BY created_at DESC
		LIMIT 200
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type serverRow struct {
		ID       string
		Name     string
		Protocol string
		Host     string
		Port     string
		IsActive bool
	}
	var servers []serverRow
	for rows.Next() {
		var s serverRow
		var port sql.NullInt64
		var active int
		if err := rows.Scan(&s.ID, &s.Name, &s.Protocol, &s.Host, &port, &active); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if port.Valid {
			s.Port = intToString(int(port.Int64))
		}
		s.IsActive = active != 0
		servers = append(servers, s)
	}

	view.Render(w, r, "servers.tmpl", view.M{
		"Title":   "Servers",
		"Servers": servers,
	})
}

func (h *Handlers) ActivityPage(w http.ResponseWriter, r *http.Request) {
	view.Render(w, r, "activity.tmpl", view.M{
		"Title": "Activity",
	})
}

func (h *Handlers) WireGuardPage(w http.ResponseWriter, r *http.Request) {
	cfg, server, live, hostUp, tunUp, err := wireguard.LoadWireGuardState(h.svc.DB, h.svc.Config.WGInterface, h.svc.StartedAt)
	if err != nil {
		view.Render(w, r, "wireguard.tmpl", view.M{
			"Title":     "Wireguard",
			"LoadError": err.Error(),
		})
		return
	}

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "wireguard.tmpl", view.M{
		"Title":             "Wireguard",
		"WGConfig":          cfg,
		"WGServer":          server,
		"WGLive":            live,
		"HostUptimeSeconds": hostUp,
		"TunnelUptimeSeconds": tunUp,
		"SaveMessage":       msg,
		"SaveMessageType":   msgType,
	})
}

func (h *Handlers) SettingsPage(w http.ResponseWriter, r *http.Request) {
	view.Render(w, r, "settings.tmpl", view.M{
		"Title": "Settings",
	})
}

func (h *Handlers) WireGuardSavePost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	update := wireguard.WireGuardUpdate{
		ServerPrivateKey: strings.TrimSpace(r.FormValue("server_private_key")),
		Config: wireguard.WireGuardConfig{
			Enabled:            true,
			ServerHost:         strings.TrimSpace(r.FormValue("server_host")),
			ServerPort:         mustAtoi(r.FormValue("server_port"), 51820),
			ServerAddress:      strings.TrimSpace(r.FormValue("server_address")),
			ClientAddressRange: strings.TrimSpace(r.FormValue("client_address_range")),
			DNS:                strings.TrimSpace(r.FormValue("dns")),
			MTU:                mustAtoi(r.FormValue("mtu"), 1420),
			PersistentKeepalive: mustAtoi(r.FormValue("persistent_keepalive"), 25),
			AllowedIPs:         strings.TrimSpace(r.FormValue("allowed_ips")),
			PreUp:              r.FormValue("pre_up"),
			PostUp:             r.FormValue("post_up"),
			PreDown:            r.FormValue("pre_down"),
			PostDown:           r.FormValue("post_down"),
		},
	}
	res, err := wireguard.SaveWireGuardState(h.svc.DB, h.svc.Config.DataDir, h.svc.Config.WGInterface, update)
	if err != nil {
		http.Redirect(w, r, "/dashboard/wireguard?msgType=error&msg="+urlQueryEscape(err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, "/dashboard/wireguard?msgType="+urlQueryEscape(res.Type)+"&msg="+urlQueryEscape(res.Text), http.StatusFound)
}

func (h *Handlers) WireGuardReloadPost(w http.ResponseWriter, r *http.Request) {
	res, err := wireguard.ReloadWireGuard(h.svc.DB, h.svc.Config.DataDir, h.svc.Config.WGInterface)
	if err != nil {
		http.Redirect(w, r, "/dashboard/wireguard?msgType=error&msg="+urlQueryEscape(err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, "/dashboard/wireguard?msgType="+urlQueryEscape(res.Type)+"&msg="+urlQueryEscape(res.Text), http.StatusFound)
}

func (h *Handlers) WireGuardAPIGet(w http.ResponseWriter, r *http.Request) {
	cfg, server, live, hostUp, tunUp, err := wireguard.LoadWireGuardState(h.svc.DB, h.svc.Config.WGInterface, h.svc.StartedAt)
	if err != nil {
		http.Error(w, `{"error":"failed to load"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"config":              cfg,
		"server":              server,
		"live":                live,
		"hostUptimeSeconds":   hostUp,
		"tunnelUptimeSeconds": tunUp,
	})
}

func (h *Handlers) WireGuardAPIPut(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Config           wireguard.WireGuardConfig `json:"config"`
		ServerPrivateKey string                  `json:"serverPrivateKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"bad json"}`, http.StatusBadRequest)
		return
	}
	res, err := wireguard.SaveWireGuardState(h.svc.DB, h.svc.Config.DataDir, h.svc.Config.WGInterface, wireguard.WireGuardUpdate{
		Config:           payload.Config,
		ServerPrivateKey: payload.ServerPrivateKey,
	})
	if err != nil {
		http.Error(w, `{"error":"save failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"message":         res.Text,
		"wireGuardWriteOk": res.WroteConfig,
		"wireGuardReloaded": res.Applied,
	})
}

func urlQueryEscape(s string) string {
	return strings.ReplaceAll(url.QueryEscape(s), "+", "%20")
}

func (h *Handlers) BandwidthHistoryAPI(w http.ResponseWriter, r *http.Request) {
	mode := strings.TrimSpace(r.URL.Query().Get("mode"))
	if mode == "" {
		mode = "hourly"
	}

	type hourlyPoint struct {
		Timestamp    string `json:"timestamp"`
		DownloadRate int64  `json:"downloadRate"`
		UploadRate   int64  `json:"uploadRate"`
	}
	type dailyPoint struct {
		Day          int    `json:"day"`
		Timestamp    string `json:"timestamp"`
		DownloadTotal int64 `json:"downloadTotal"`
		UploadTotal   int64 `json:"uploadTotal"`
		CombinedTotal int64 `json:"combinedTotal"`
	}

	now := time.Now()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if mode == "daily" {
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		startSQL := start.UTC().Format("2006-01-02 15:04:05")
		rows, err := h.svc.DB.Query(`
			SELECT timestamp, download_rate, upload_rate
			FROM bandwidth_snapshots
			WHERE timestamp >= ?
			ORDER BY timestamp ASC
		`, startSQL)
		if err != nil {
			http.Error(w, `{"error":"query failed"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type snap struct {
			T time.Time
			D int64
			U int64
		}
		var snaps []snap
		for rows.Next() {
			var ts string
			var d, u int64
			if err := rows.Scan(&ts, &d, &u); err != nil {
				http.Error(w, `{"error":"scan failed"}`, http.StatusInternalServerError)
				return
			}
			t, err := time.Parse(time.RFC3339, ts)
			if err != nil {
				// sqlite datetime('now') is not RFC3339; try common layout.
				t2, err2 := time.ParseInLocation("2006-01-02 15:04:05", ts, time.UTC)
				if err2 != nil {
					continue
				}
				t = t2
			}
			snaps = append(snaps, snap{T: t, D: d, U: u})
		}

		// Integrate rate over time -> bytes/day.
		byDayD := map[int]int64{}
		byDayU := map[int]int64{}
		for i := 0; i < len(snaps)-1; i++ {
			a := snaps[i]
			b := snaps[i+1]
			dt := b.T.Sub(a.T)
			if dt <= 0 {
				continue
			}
			// Clamp dt to avoid huge jumps if the service was paused.
			if dt > 2*time.Duration(h.svc.Config.WGInterval)*time.Second {
				dt = time.Duration(h.svc.Config.WGInterval) * time.Second
			}
			sec := int64(dt.Seconds())
			day := a.T.In(now.Location()).Day()
			byDayD[day] += a.D * sec
			byDayU[day] += a.U * sec
		}

		var out []dailyPoint
		daysInMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Day()
		for day := 1; day <= daysInMonth; day++ {
			ts := time.Date(now.Year(), now.Month(), day, 0, 0, 0, 0, now.Location()).Format(time.RFC3339)
			d := byDayD[day]
			u := byDayU[day]
			out = append(out, dailyPoint{
				Day:           day,
				Timestamp:     ts,
				DownloadTotal: d,
				UploadTotal:   u,
				CombinedTotal: d + u,
			})
		}

		_, _ = w.Write([]byte(`{"history":`))
		enc := json.NewEncoder(w)
		_ = enc.Encode(out)
		// enc adds newline; close json object.
		_, _ = w.Write([]byte(`}`))
		return
	}

	hours := 24
	if v := strings.TrimSpace(r.URL.Query().Get("hours")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 24*14 {
			hours = n
		}
	}
	since := now.Add(-time.Duration(hours) * time.Hour)
	sinceSQL := since.UTC().Format("2006-01-02 15:04:05")

	rows, err := h.svc.DB.Query(`
		SELECT timestamp, download_rate, upload_rate
		FROM bandwidth_snapshots
		WHERE timestamp >= ?
		ORDER BY timestamp ASC
	`, sinceSQL)
	if err != nil {
		http.Error(w, `{"error":"query failed"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []hourlyPoint
	for rows.Next() {
		var ts string
		var d, u int64
		if err := rows.Scan(&ts, &d, &u); err != nil {
			http.Error(w, `{"error":"scan failed"}`, http.StatusInternalServerError)
			return
		}
		out = append(out, hourlyPoint{Timestamp: ts, DownloadRate: d, UploadRate: u})
	}
	_, _ = w.Write([]byte(`{"history":`))
	enc := json.NewEncoder(w)
	_ = enc.Encode(out)
	_, _ = w.Write([]byte(`}`))
}

func (h *Handlers) DashboardStatsPartial(w http.ResponseWriter, r *http.Request) {
	type stats struct {
		TotalUsers     int
		EnabledUsers   int
		ConnectedUsers int
		ActiveServers  int
	}
	var s stats
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users`).Scan(&s.TotalUsers)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users WHERE is_enabled = 1`).Scan(&s.EnabledUsers)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_users WHERE is_connected = 1`).Scan(&s.ConnectedUsers)
	_ = h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_servers WHERE is_active = 1`).Scan(&s.ActiveServers)

	view.RenderPartial(w, r, "partials/dashboard_stats.tmpl", view.M{
		"Stats": s,
	})
}

func (h *Handlers) ActiveConnectionsPartial(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.DB.Query(`
		SELECT username, endpoint, last_handshake, bytes_received_rate, bytes_sent_rate, connected_at
		FROM vpn_users
		WHERE is_connected = 1 AND is_enabled = 1
		ORDER BY connected_at DESC
		LIMIT 200
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type row struct {
		Username      string
		Endpoint      string
		LastHandshake string
		RxRate        int64
		TxRate        int64
		ConnectedAt   string
	}
	var out []row
	for rows.Next() {
		var r row
		var endpoint, hs, ca sql.NullString
		if err := rows.Scan(&r.Username, &endpoint, &hs, &r.RxRate, &r.TxRate, &ca); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if endpoint.Valid {
			r.Endpoint = endpoint.String
		}
		if hs.Valid {
			r.LastHandshake = hs.String
		}
		if ca.Valid {
			r.ConnectedAt = ca.String
		}
		out = append(out, r)
	}

	view.RenderPartial(w, r, "partials/active_connections.tmpl", view.M{
		"Connections": out,
	})
}

func intToString(n int) string {
	return strconv.Itoa(n)
}

