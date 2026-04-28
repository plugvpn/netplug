// Package assets serves third-party JS vendored for offline / air-gapped installs.
//
// Vendored versions (see internal/assets/vendor/):
//   - htmx.org 2.0.6
//   - Tailwind CSS 3.4.17 (compiled via `npm run build:css` → app.css)
//   - lucide 0.563.0 UMD
//   - chart.js 4.4.3 UMD
//   - qrcode 1.5.4 (+ dijkstrajs 1.0.3) ESM, import patched for local load
package assets

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed vendor/*
var raw embed.FS

// FS returns the vendor file tree rooted at "." (e.g. htmx.min.js).
func FS() fs.FS {
	sub, err := fs.Sub(raw, "vendor")
	if err != nil {
		panic("assets: " + err.Error())
	}
	return sub
}

// Handler serves files from FS at the URL path (use with StripPrefix("/assets/", ...)).
func Handler() http.Handler {
	return http.FileServer(http.FS(FS()))
}
