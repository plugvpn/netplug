package app

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
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
	}
	rows, err := h.svc.DB.Query(`
		SELECT
			g.id,
			g.name,
			COALESCE(g.description, ''),
			(SELECT COUNT(*) FROM vpn_group_members m WHERE m.group_id = g.id)
		FROM vpn_groups g
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
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.MemberCount); err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
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

func (h *Handlers) GroupAddModalPartial(w http.ResponseWriter, r *http.Request) {
	view.RenderPartial(w, r, "partials/add_group_modal.tmpl", view.M{})
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
		redirectOrHTMX(w, r, "/ui/groups/"+groupID)
		return
	}
	_, err := h.svc.DB.Exec(
		`INSERT OR IGNORE INTO vpn_group_members (group_id, vpn_user_id) VALUES (?, ?)`,
		groupID, userID,
	)
	if err != nil {
		redirectOrHTMX(w, r, "/ui/groups/"+groupID+"?msg="+urlQueryEscape("Could not add member.")+"&msgType=error")
		return
	}
	h.reconcilePCQ()
	redirectOrHTMX(w, r, "/ui/groups/"+groupID)
}

func (h *Handlers) GroupMemberBulkAddPost(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}
	var n int
	if err := h.svc.DB.QueryRow(`SELECT COUNT(*) FROM vpn_groups WHERE id = ?`, groupID).Scan(&n); err != nil || n == 0 {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	ids := r.Form["vpn_user_id"]
	if len(ids) == 0 {
		redirectOrHTMXWithToast(w, r, "/ui/groups/"+groupID, "danger", "Select at least one user.")
		return
	}
	added := 0
	for _, uid := range ids {
		uid = strings.TrimSpace(uid)
		if uid == "" {
			continue
		}
		res, err := h.svc.DB.Exec(
			`INSERT OR IGNORE INTO vpn_group_members (group_id, vpn_user_id) VALUES (?, ?)`,
			groupID, uid,
		)
		if err != nil {
			redirectOrHTMXWithToast(w, r, "/ui/groups/"+groupID, "danger", "Could not add members.")
			return
		}
		ra, _ := res.RowsAffected()
		added += int(ra)
	}
	h.reconcilePCQ()
	msg := fmt.Sprintf("Added %d member(s).", added)
	if added == 0 {
		msg = "No new members added (selected users were already in this group)."
	}
	redirectOrHTMXWithToast(w, r, "/ui/groups/"+groupID, "success", msg)
}

func redirectOrHTMX(w http.ResponseWriter, r *http.Request, path string) {
	redirectOrHTMXWithToast(w, r, path, "", "")
}

// redirectOrHTMXWithToast sets HX-Trigger toast when toastMsg is non-empty (HTMX responses only).
func redirectOrHTMXWithToast(w http.ResponseWriter, r *http.Request, path string, toastType, toastMsg string) {
	if strings.EqualFold(r.Header.Get("HX-Request"), "true") {
		if strings.TrimSpace(toastMsg) != "" {
			tt := strings.TrimSpace(toastType)
			if tt == "" {
				tt = "success"
			}
			w.Header().Set("HX-Trigger", `{"toast":{"type":`+strconv.Quote(tt)+`,"message":`+strconv.Quote(toastMsg)+`}}`)
		}
		w.Header().Set("HX-Redirect", path)
		w.WriteHeader(http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, path, http.StatusFound)
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
		redirectOrHTMX(w, r, "/ui/groups/"+groupID+"?msg="+urlQueryEscape("Could not remove member.")+"&msgType=error")
		return
	}
	h.reconcilePCQ()
	redirectOrHTMX(w, r, "/ui/groups/"+groupID)
}

type groupPickUser struct {
	ID       string
	Username string
	TunnelIP string
}

func queryUsersNotInGroup(db *sql.DB, groupID string) ([]groupPickUser, error) {
	rows, err := db.Query(`
		SELECT u.id, u.username, COALESCE(u.allowed_ips, '')
		FROM vpn_users u
		WHERE NOT EXISTS (
			SELECT 1 FROM vpn_group_members m
			WHERE m.group_id = ? AND m.vpn_user_id = u.id
		)
		ORDER BY u.username COLLATE NOCASE ASC
		LIMIT 500
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []groupPickUser
	for rows.Next() {
		var o groupPickUser
		var allowed string
		if err := rows.Scan(&o.ID, &o.Username, &allowed); err != nil {
			return nil, err
		}
		o.TunnelIP = firstTunnelIPCIDR(allowed)
		out = append(out, o)
	}
	return out, rows.Err()
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

func (h *Handlers) GroupDeleteModalPartial(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	if groupID == "" {
		http.NotFound(w, r)
		return
	}
	var gName string
	if err := h.svc.DB.QueryRow(`SELECT name FROM vpn_groups WHERE id = ? LIMIT 1`, groupID).Scan(&gName); err != nil {
		http.NotFound(w, r)
		return
	}
	view.RenderPartial(w, r, "partials/delete_group_modal.tmpl", view.M{
		"GroupID":   groupID,
		"GroupName": gName,
	})
}

func (h *Handlers) GroupMemberRemoveModalPartial(w http.ResponseWriter, r *http.Request) {
	groupID := strings.TrimSpace(chi.URLParam(r, "id"))
	userID := strings.TrimSpace(chi.URLParam(r, "user_id"))
	if groupID == "" || userID == "" {
		http.NotFound(w, r)
		return
	}
	var username string
	if err := h.svc.DB.QueryRow(`SELECT username FROM vpn_users WHERE id = ? LIMIT 1`, userID).Scan(&username); err != nil {
		http.NotFound(w, r)
		return
	}
	view.RenderPartial(w, r, "partials/remove_member_modal.tmpl", view.M{
		"GroupID":  groupID,
		"UserID":   userID,
		"Username": username,
	})
}

func (h *Handlers) GroupAddMembersModalPartial(w http.ResponseWriter, r *http.Request) {
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
	candidates, err := queryUsersNotInGroup(h.svc.DB, groupID)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	view.RenderPartial(w, r, "partials/group_add_members_modal.tmpl", view.M{
		"GroupID":     groupID,
		"GroupName":   gName,
		"Candidates":  candidates,
	})
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

	msg := strings.TrimSpace(r.URL.Query().Get("msg"))
	msgType := strings.TrimSpace(r.URL.Query().Get("msgType"))

	view.Render(w, r, "group_detail.tmpl", view.M{
		"Title":        gName,
		"GroupID":      groupID,
		"GroupName":    gName,
		"GroupDesc":    gDesc,
		"Members":      members,
		"FlashMsg":     msg,
		"FlashMsgType": msgType,
	})
}
