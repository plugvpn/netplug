package app

import (
	"database/sql"
	"net/http"
	"strings"

	"netplug-go/internal/view"
	"netplug-go/internal/wireguard"

	"github.com/go-chi/chi/v5"
)

func (h *Handlers) GroupsPage(w http.ResponseWriter, r *http.Request) {
	type row struct {
		ID          string
		Name        string
		Description string
		MemberCount int
		PCQSummary  string
	}
	rows, err := h.svc.DB.Query(`
		SELECT
			g.id,
			g.name,
			COALESCE(g.description, ''),
			(SELECT COUNT(*) FROM vpn_group_members m WHERE m.group_id = g.id),
			p.download_limit_kbps,
			p.upload_limit_kbps
		FROM vpn_groups g
		LEFT JOIN vpn_group_pcq p ON p.group_id = g.id
		ORDER BY g.name COLLATE NOCASE ASC
		LIMIT 300
	`)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []row
	for rows.Next() {
		var g row
		var dl, ul sql.NullInt64
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.MemberCount, &dl, &ul); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		g.PCQSummary = pcqLimitsSummary(dl, ul)
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "groups.tmpl", view.M{
		"Title":        "Groups",
		"Groups":       groups,
		"FlashMsg":     msg,
		"FlashMsgType": msgType,
	})
}

func (h *Handlers) GroupCreatePost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		http.Redirect(w, r, "/ui/groups", http.StatusFound)
		return
	}
	desc := strings.TrimSpace(r.FormValue("description"))
	id := wireguard.NewID()
	_, err := h.svc.DB.Exec(`INSERT INTO vpn_groups (id, name, description) VALUES (?, ?, ?)`, id, name, nullIfEmptyStr(desc))
	if err != nil {
		http.Redirect(w, r, "/ui/groups?msg="+urlQueryEscape("A group with that name may already exist.")+"&msgType=error", http.StatusFound)
		return
	}
	http.Redirect(w, r, "/ui/groups/"+id, http.StatusFound)
}

func nullIfEmptyStr(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func (h *Handlers) GroupDeletePost(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		http.NotFound(w, r)
		return
	}
	res, err := h.svc.DB.Exec(`DELETE FROM vpn_groups WHERE id = ?`, id)
	if err != nil {
		http.Redirect(w, r, "/ui/groups/"+id+"?msg="+urlQueryEscape("Could not delete group.")+"&msgType=error", http.StatusFound)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		http.NotFound(w, r)
		return
	}
	http.Redirect(w, r, "/ui/groups", http.StatusFound)
}

func (h *Handlers) GroupMemberAddPost(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	userID := strings.TrimSpace(r.FormValue("vpn_user_id"))
	if userID == "" {
		http.Redirect(w, r, "/ui/groups/"+groupID, http.StatusFound)
		return
	}
	_, err := h.svc.DB.Exec(
		`INSERT OR IGNORE INTO vpn_group_members (group_id, vpn_user_id) VALUES (?, ?)`,
		groupID, userID,
	)
	if err != nil {
		http.Redirect(w, r, "/ui/groups/"+groupID+"?msg="+urlQueryEscape("Could not add member.")+"&msgType=error", http.StatusFound)
		return
	}
	h.reconcilePCQ()
	http.Redirect(w, r, "/ui/groups/"+groupID, http.StatusFound)
}

func (h *Handlers) GroupMemberRemovePost(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	userID := strings.TrimSpace(chi.URLParam(r, "user_id"))
	if groupID == "" || userID == "" {
		http.NotFound(w, r)
		return
	}
	_, err := h.svc.DB.Exec(`DELETE FROM vpn_group_members WHERE group_id = ? AND vpn_user_id = ?`, groupID, userID)
	if err != nil {
		http.Redirect(w, r, "/ui/groups/"+groupID+"?msg="+urlQueryEscape("Could not remove member.")+"&msgType=error", http.StatusFound)
		return
	}
	h.reconcilePCQ()
	http.Redirect(w, r, "/ui/groups/"+groupID, http.StatusFound)
}

func firstTunnelIPCIDR(allowedIPs string) string {
	s := strings.TrimSpace(allowedIPs)
	if s == "" {
		return ""
	}
	if i := strings.IndexByte(s, ','); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	return s
}

func (h *Handlers) GroupDetailPage(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}

	var gName, gDesc string
	err := h.svc.DB.QueryRow(`SELECT name, COALESCE(description, '') FROM vpn_groups WHERE id = ? LIMIT 1`, groupID).Scan(&gName, &gDesc)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	type memberRow struct {
		UserID   string
		Username string
		TunnelIP string
	}
	mrows, err := h.svc.DB.Query(`
		SELECT u.id, u.username, COALESCE(u.allowed_ips, '')
		FROM vpn_group_members m
		JOIN vpn_users u ON u.id = m.vpn_user_id
		WHERE m.group_id = ?
		ORDER BY u.username COLLATE NOCASE ASC
	`, groupID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer mrows.Close()

	var members []memberRow
	for mrows.Next() {
		var m memberRow
		var allowed sql.NullString
		if err := mrows.Scan(&m.UserID, &m.Username, &allowed); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		if allowed.Valid {
			m.TunnelIP = firstTunnelIPCIDR(allowed.String)
		}
		members = append(members, m)
	}
	if err := mrows.Err(); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	availRows, err := h.svc.DB.Query(`
		SELECT u.id, u.username
		FROM vpn_users u
		WHERE NOT EXISTS (
			SELECT 1 FROM vpn_group_members m
			WHERE m.group_id = ? AND m.vpn_user_id = u.id
		)
		ORDER BY u.username COLLATE NOCASE ASC
		LIMIT 500
	`, groupID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer availRows.Close()

	type opt struct {
		ID       string
		Username string
	}
	var addOptions []opt
	for availRows.Next() {
		var o opt
		if err := availRows.Scan(&o.ID, &o.Username); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		addOptions = append(addOptions, o)
	}

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "group_detail.tmpl", view.M{
		"Title":        gName,
		"GroupID":      groupID,
		"GroupName":    gName,
		"GroupDesc":    gDesc,
		"Members":      members,
		"AddUserOpts":  addOptions,
		"FlashMsg":     msg,
		"FlashMsgType": msgType,
	})
}
