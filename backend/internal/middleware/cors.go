package middleware

import (
	"github.com/go-chi/cors"
)

func CORS() cors.Options {
	return cors.Options{
		AllowedOrigins:   []string{"http://localhost:5273", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}
}
