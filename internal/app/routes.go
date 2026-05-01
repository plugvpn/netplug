package app

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, svc *Services) {
	h := NewHandlers(svc)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ui", http.StatusFound)
	})

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/login", func(r chi.Router) {
		r.Get("/", h.LoginPage)
		r.Post("/", h.LoginPost)
	})

	r.Route("/setup", func(r chi.Router) {
		r.Get("/", h.SetupPage)
		r.Post("/admin", h.SetupAdminPost)
		r.Post("/login", h.SetupLoginPost)
		r.Post("/wireguard", h.SetupWireGuardPost)
		r.Post("/wireguard/import", h.SetupWireGuardImportPost)
		r.Post("/wireguard/generate-keys", h.SetupGenerateKeysPartial)
	})

	r.With(h.RequireAuth).Group(func(r chi.Router) {
		r.Post("/logout", h.LogoutPost)

		r.Get("/ui", h.UIPage)
		r.Get("/ui/users", h.UsersPage)
		r.Get("/ui/groups", h.GroupsPage)
		r.Post("/ui/groups", h.GroupCreatePost)
		r.Get("/ui/pcq", h.PCQOverviewPage)
		r.Get("/ui/groups/{id}/pcq", h.GroupPCQPage)
		r.Post("/ui/groups/{id}/pcq", h.GroupPCQSavePost)
		r.Get("/ui/groups/{id}", h.GroupDetailPage)
		r.Post("/ui/groups/{id}/delete", h.GroupDeletePost)
		r.Post("/ui/groups/{id}/members", h.GroupMemberAddPost)
		r.Post("/ui/groups/{id}/members/{user_id}/remove", h.GroupMemberRemovePost)
		r.Post("/ui/users", h.UserCreatePost)
		r.Post("/ui/users/{id}/edit", h.UserUpdatePost)
		r.Post("/ui/users/{id}/delete", h.UserDeletePost)
		r.Post("/ui/users/{id}/toggle", h.UserTogglePost)
		r.Get("/ui/users/{id}/config", h.UserConfigGet)
		r.Get("/ui/connections", h.ConnectionsPage)
		r.Get("/ui/servers", h.ServersPage)
		r.Get("/ui/wireguard", h.WireGuardPage)
		r.Post("/ui/wireguard/save", h.WireGuardSavePost)
		r.Post("/ui/wireguard/reload", h.WireGuardReloadPost)
		r.Get("/ui/settings", h.SettingsPage)

		// HTMX partials
		r.Get("/partials/ui/stats", h.UIStatsPartial)
		r.Get("/partials/ui/active-connections", h.ActiveConnectionsPartial)
		r.Get("/partials/overview/all", h.OverviewAllPartial)
		r.Get("/partials/users/add-modal", h.AddUserModalPartial)
		r.Get("/partials/users/{id}/edit-modal", h.EditUserModalPartial)
		r.Get("/partials/users/{id}/qr-modal", h.UserQRModalPartial)
		r.Get("/partials/users/{id}/delete-modal", h.UserDeleteModalPartial)
		r.Get("/partials/empty", h.EmptyPartial)

		// JSON APIs (for chart parity)
		r.Get("/api/bandwidth/history", h.BandwidthHistoryAPI)
		r.Get("/api/wireguard", h.WireGuardAPIGet)
		r.Put("/api/wireguard", h.WireGuardAPIPut)
		r.Post("/api/users/generate-keys", h.UsersGenerateKeysAPI)
		r.Post("/api/users/derive-public-key", h.UsersDerivePublicKeyAPI)
		r.Post("/api/users/generate-psk", h.UsersGeneratePSKAPI)
		r.Get("/api/users/next-ip", h.UsersNextIPAPI)
		r.Get("/api/users/{id}/config", h.UserConfigAPIGet)
	})
}
