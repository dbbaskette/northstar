package service

import (
	"context"

	"github.com/rs/zerolog/log"

	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/ws"
)

// Events emits both an activity log entry and a WebSocket broadcast.
type Events struct {
	activityRepo *repository.ActivityRepo
	hub          *ws.Hub
}

func NewEvents(activityRepo *repository.ActivityRepo, hub *ws.Hub) *Events {
	return &Events{activityRepo: activityRepo, hub: hub}
}

// Emit logs an activity and broadcasts a WebSocket event for the given board.
// `entityID` is the primary entity affected (card id, list id, etc.).
// `payload` is the JSON payload sent to WebSocket subscribers.
func (e *Events) Emit(
	ctx context.Context,
	boardID, userID, action, entityType, entityID string,
	payload interface{},
) {
	if e == nil {
		return
	}
	if err := e.activityRepo.Log(ctx, boardID, userID, action, entityType, entityID, payload); err != nil {
		log.Warn().Err(err).Str("action", action).Msg("activity log failed")
	}
	e.hub.Broadcast(boardID, userID, action, payload)
}
