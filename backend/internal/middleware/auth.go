package middleware

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const UserIDKey contextKey = "user_id"

type TokenValidator interface {
	ValidateAccessToken(token string) (string, error)
}

// APITokenLookup turns a personal access token into a user_id.
// Optional — pass nil to disable API-token auth.
type APITokenLookup func(ctx context.Context, token string) (string, error)

func Auth(jwtValidator TokenValidator, apiTokens APITokenLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(auth, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			token := parts[1]
			var userID string
			var err error

			// Personal access tokens use a distinct prefix so we can route
			// them straight to the API-token validator. Anything else is
			// treated as a JWT.
			if apiTokens != nil && strings.HasPrefix(token, "ns_") {
				userID, err = apiTokens(r.Context(), token)
			} else {
				userID, err = jwtValidator.ValidateAccessToken(token)
			}

			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}
