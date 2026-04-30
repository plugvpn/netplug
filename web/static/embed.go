package webstatic

import (
	"embed"
	"io/fs"
	"net/http"
)

const plugIconPath = "plug-icon.png"

//go:embed plug-icon.png
var raw embed.FS

func PlugIconPath() string { return plugIconPath }

func FS() fs.FS {
	return raw
}

func Handler() http.Handler {
	return http.FileServer(http.FS(FS()))
}

