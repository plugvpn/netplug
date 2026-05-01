package app

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"

	"netplug-go/internal/pcq"
	"netplug-go/internal/view"

	"github.com/go-chi/chi/v5"
)

func parseIPv4Host(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "/") {
		host, _, err := net.ParseCIDR(strings.TrimSpace(s))
		if err != nil || host == nil || host.To4() == nil {
			return ""
		}
		return host.To4().String()
	}
	ip := net.ParseIP(s).To4()
	if ip == nil {
		return ""
	}
	return ip.String()
}

func groupMemberTunnelIPs(dbConn *sql.DB, groupID string) ([]string, error) {
	rows, err := dbConn.Query(`
		SELECT COALESCE(u.allowed_ips, '')
		FROM vpn_group_members m
		JOIN vpn_users u ON u.id = m.vpn_user_id
		WHERE m.group_id = ?
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ips []string
	for rows.Next() {
		var allowed sql.NullString
		if err := rows.Scan(&allowed); err != nil {
			return nil, err
		}
		if !allowed.Valid {
			continue
		}
		tip := firstTunnelIPCIDR(allowed.String)
		if tip != "" && parseIPv4Host(tip) != "" {
			ips = append(ips, tip)
		}
	}
	return ips, rows.Err()
}

func mbpsInputToKbps(form string) *int {
	form = strings.TrimSpace(form)
	if form == "" {
		return nil
	}
	v, err := strconv.ParseFloat(form, 64)
	if err != nil || v <= 0 {
		return nil
	}
	k := int(math.Round(v * 1024))
	if k <= 0 {
		return nil
	}
	return &k
}

func kbpsDisplayMbps(k *int) string {
	if k == nil || *k <= 0 {
		return ""
	}
	mb := float64(*k) / 1024.0
	s := strconv.FormatFloat(mb, 'f', 1, 64)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	if s == "" {
		s = "0"
	}
	return s
}

func ptrPositiveKbps(v sql.NullInt64) *int {
	if !v.Valid || v.Int64 <= 0 {
		return nil
	}
	x := int(v.Int64)
	return &x
}

func pcqLimitsSummary(dl, ul sql.NullInt64) string {
	switch {
	case dl.Valid && dl.Int64 > 0 && ul.Valid && ul.Int64 > 0:
		return kbpsDisplayMbps(ptrPositiveKbps(dl)) + "↓ " + kbpsDisplayMbps(ptrPositiveKbps(ul)) + "↑ Mbps"
	case dl.Valid && dl.Int64 > 0:
		return kbpsDisplayMbps(ptrPositiveKbps(dl)) + "↓ Mbps"
	case ul.Valid && ul.Int64 > 0:
		return kbpsDisplayMbps(ptrPositiveKbps(ul)) + "↑ Mbps"
	default:
		return "—"
	}
}

func kbpsToMbpsInput(v sql.NullInt64) string {
	if !v.Valid || v.Int64 <= 0 {
		return ""
	}
	mb := float64(v.Int64) / 1024.0
	return fmt.Sprintf("%.4g", mb)
}

func (h *Handlers) PCQOverviewPage(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.DB.Query(`
		SELECT g.id,
			g.name,
			COALESCE((SELECT COUNT(*) FROM vpn_group_members m WHERE m.group_id = g.id), 0),
			p.download_limit_kbps,
			p.upload_limit_kbps,
			p.pcq_classifier
		FROM vpn_groups g
		LEFT JOIN vpn_group_pcq p ON p.group_id = g.id
		ORDER BY g.name COLLATE NOCASE ASC
		LIMIT 400
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type row struct {
		GroupID    string
		Name       string
		Members    int
		PCQSummary string
		Classifier string
		HasLimits  bool
	}
	var out []row
	for rows.Next() {
		var rec row
		var dl, ul sql.NullInt64
		var clf sql.NullString
		if err := rows.Scan(&rec.GroupID, &rec.Name, &rec.Members, &dl, &ul, &clf); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if clf.Valid && strings.TrimSpace(clf.String) != "" {
			rec.Classifier = clf.String
		} else {
			rec.Classifier = "dual"
		}

		rec.HasLimits = (dl.Valid && dl.Int64 > 0) || (ul.Valid && ul.Int64 > 0)
		rec.PCQSummary = pcqLimitsSummary(dl, ul)
		out = append(out, rec)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "pcq_overview.tmpl", view.M{
		"Title":        "PCQ",
		"Groups":       out,
		"FlashMsg":     msg,
		"FlashMsgType": msgType,
	})
}

func (h *Handlers) GroupPCQPage(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}

	var gName string
	err := h.svc.DB.QueryRow(`SELECT name FROM vpn_groups WHERE id = ? LIMIT 1`, groupID).Scan(&gName)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	tunnelIPs, err := groupMemberTunnelIPs(h.svc.DB, groupID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	var (
		dlKbps, ulKbps, burstDlKbps, burstUlKbps sql.NullInt64
		classifier                               string
	)
	err = h.svc.DB.QueryRow(`
		SELECT download_limit_kbps, upload_limit_kbps, burst_download_kbps, burst_upload_kbps,
		       IFNULL(pcq_classifier, 'dual')
		FROM vpn_group_pcq WHERE group_id = ?
	`, groupID).Scan(&dlKbps, &ulKbps, &burstDlKbps, &burstUlKbps, &classifier)
	if err != nil && err != sql.ErrNoRows {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	if err == sql.ErrNoRows {
		classifier = "dual"
	}

	previewLines, err := pcq.PlanCommands(h.svc.DB, h.svc.Config.WGInterface)
	previewText := strings.Join(previewLines, "\n")
	if err != nil {
		previewText = "# error building tc plan: " + err.Error()
	}

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "group_pcq.tmpl", view.M{
		"Title":                "PCQ — " + gName,
		"GroupID":              groupID,
		"GroupName":            gName,
		"DownloadMbpsInput":    kbpsToMbpsInput(dlKbps),
		"UploadMbpsInput":      kbpsToMbpsInput(ulKbps),
		"BurstDownloadInput":   kbpsToMbpsInput(burstDlKbps),
		"BurstUploadInput":     kbpsToMbpsInput(burstUlKbps),
		"ClassifierMode":       classifier,
		"LinuxTCPreview":       previewText,
		"WGInterface":          h.svc.Config.WGInterface,
		"MemberTunnelIPs":      tunnelIPs,
		"MemberTunnelIPsCount": len(tunnelIPs),
		"FlashMsg":             msg,
		"FlashMsgType":         msgType,
	})
}

func (h *Handlers) GroupPCQSavePost(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}

	dest := "/ui/groups/" + groupID + "/pcq"

	var n int
	if err := h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_groups WHERE id = ?`, groupID).Scan(&n); err != nil || n == 0 {
		http.NotFound(w, r)
		return
	}

	if r.FormValue("clear_pcq") == "on" {
		if _, err := h.svc.DB.Exec(`DELETE FROM vpn_group_pcq WHERE group_id = ?`, groupID); err != nil {
			http.Redirect(w, r, dest+"?msg="+urlQueryEscape("Could not clear PCQ settings.")+"&msgType=error", http.StatusFound)
			return
		}
		h.reconcilePCQ()
		http.Redirect(w, r, dest+"?msg="+urlQueryEscape("PCQ settings cleared.")+"&msgType=success", http.StatusFound)
		return
	}

	mode := strings.ToLower(strings.TrimSpace(r.FormValue("pcq_classifier")))
	switch mode {
	case "dst-download", "src-upload", "dual":
	default:
		mode = "dual"
	}

	dl := mbpsInputToKbps(r.FormValue("download_mbps"))
	ul := mbpsInputToKbps(r.FormValue("upload_mbps"))
	bd := mbpsInputToKbps(r.FormValue("burst_download_mbps"))
	bu := mbpsInputToKbps(r.FormValue("burst_upload_mbps"))

	var dlSQL, ulSQL, bdSQL, buSQL any
	if dl != nil {
		dlSQL = *dl
	}
	if ul != nil {
		ulSQL = *ul
	}
	if bd != nil {
		bdSQL = *bd
	}
	if bu != nil {
		buSQL = *bu
	}

	_, err := h.svc.DB.Exec(`
		INSERT INTO vpn_group_pcq (
		  group_id, download_limit_kbps, upload_limit_kbps,
		  burst_download_kbps, burst_upload_kbps, pcq_classifier,
		  updated_at
		) VALUES (?,?,?,?,?,?, datetime('now'))
		ON CONFLICT(group_id) DO UPDATE SET
		  download_limit_kbps = excluded.download_limit_kbps,
		  upload_limit_kbps = excluded.upload_limit_kbps,
		  burst_download_kbps = excluded.burst_download_kbps,
		  burst_upload_kbps = excluded.burst_upload_kbps,
		  pcq_classifier = excluded.pcq_classifier,
		  updated_at = excluded.updated_at
	`, groupID, dlSQL, ulSQL, bdSQL, buSQL, mode)

	if err != nil {
		http.Redirect(w, r, dest+"?msg="+urlQueryEscape("Could not save PCQ settings.")+"&msgType=error", http.StatusFound)
		return
	}
	h.reconcilePCQ()
	http.Redirect(w, r, dest+"?msg="+urlQueryEscape("PCQ settings saved.")+"&msgType=success", http.StatusFound)
}

func (h *Handlers) reconcilePCQ() {
	if h == nil || h.svc.DB == nil {
		return
	}
	opts := pcq.ApplyOpts{
		Debug:  h.svc.Config.Debug,
		Logger: h.svc.Logger,
	}
	if _, err := pcq.Apply(h.svc.DB, h.svc.Config.WGInterface, h.svc.Config.PCQDisabled, opts); err != nil && h.svc.Logger == nil {
		log.Printf("pcq.Apply: %v", err)
	}
}
