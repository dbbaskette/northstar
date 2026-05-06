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
	notifRepo    *repository.NotificationRepo
	hub          *ws.Hub
}

func NewEvents(activityRepo *repository.ActivityRepo, notifRepo *repository.NotificationRepo, hub *ws.Hub) *Events {
	return &Events{activityRepo: activityRepo, notifRepo: notifRepo, hub: hub}
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

// Notify creates per-user notifications. Skips the actor (you don't
// notify yourself about your own actions).
func (e *Events) Notify(
	ctx context.Context,
	recipientUserIDs []string,
	actorUserID, notifType, sourceCardID, sourceBoardID string,
	payload interface{},
) {
	if e == nil {
		return
	}
	for _, uid := range recipientUserIDs {
		if uid == "" || uid == actorUserID {
			continue
		}
		if err := e.notifRepo.Create(ctx, uid, notifType, payload, sourceCardID, sourceBoardID); err != nil {
			log.Warn().Err(err).Str("type", notifType).Str("user", uid).Msg("notification create failed")
		}
	}
}
