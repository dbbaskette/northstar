package static

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// Handler returns an http.Handler that serves the embedded frontend dist
// directory. Any request that does not map to a real file (e.g. /dashboard,
// /boards/abc) falls back to index.html so the React Router takes over.
//
// If the dist/ directory is empty (development build), the handler returns
// a tiny help message so users know how to populate it.
func Handler() http.Handler {
	dist, err := fs.Sub(distFS, "dist")
	if err != nil {
		return placeholderHandler()
	}

	if _, err := fs.Stat(dist, "index.html"); err != nil {
		return placeholderHandler()
	}

	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/health" {
			http.NotFound(w, r)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if _, err := fs.Stat(dist, path); err != nil {
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}

		fileServer.ServeHTTP(w, r)
	})
}

func placeholderHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/health" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`<!doctype html>
<html><head><title>Northstar</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; padding: 2rem; line-height: 1.5;">
<h1>Northstar — frontend not embedded</h1>
<p>The Go binary was built without an embedded frontend. To produce a deployable artifact:</p>
<pre>  make build</pre>
<p>For local development, run <code>./start.sh</code> instead — Vite serves the frontend at port 5273 and proxies <code>/api/*</code> to this Go server.</p>
</body></html>`))
	})
}
