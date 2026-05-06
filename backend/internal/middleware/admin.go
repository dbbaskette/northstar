package middleware

import (
	"context"
	"net/http"

	"github.com/dbbaskette/northstar/internal/repository"
)

// RequireAdmin wraps a handler so it returns 403 unless the authenticated
// user has role = 'admin'. Auth() must run first to populate the user-id
// in the request context.
func RequireAdmin(userRepo *repository.UserRepo) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid := GetUserID(r.Context())
			if uid == "" {
				http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
				return
			}
			u, err := userRepo.FindByID(r.Context(), uid)
			if err != nil || u == nil {
				http.Error(w, `{"error":"user lookup failed"}`, http.StatusForbidden)
				return
			}
			if u.Role != "admin" {
				http.Error(w, `{"error":"admin access required"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP returns the request's IP address, preferring X-Forwarded-For
// when present (CF and most proxies set this). Falls back to RemoteAddr.
func ClientIP(r *http.Request) string {
	if h := r.Header.Get("X-Forwarded-For"); h != "" {
		// First entry is the original client.
		for i := 0; i < len(h); i++ {
			if h[i] == ',' {
				return h[:i]
			}
		}
		return h
	}
	return r.RemoteAddr
}

// AuditContext bundles request metadata for audit log entries — pulled
// from the http.Request once and threaded through the call chain so
// service-layer code doesn't need to know about HTTP types.
type AuditContext struct {
	IP        string
	UserAgent string
}

func ExtractAudit(r *http.Request) AuditContext {
	return AuditContext{IP: ClientIP(r), UserAgent: r.UserAgent()}
}

type auditCtxKey struct{}

func WithAuditContext(ctx context.Context, ac AuditContext) context.Context {
	return context.WithValue(ctx, auditCtxKey{}, ac)
}

func GetAuditContext(ctx context.Context) AuditContext {
	if v, ok := ctx.Value(auditCtxKey{}).(AuditContext); ok {
		return v
	}
	return AuditContext{}
}
