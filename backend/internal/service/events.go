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
	watcherRepo  *repository.WatcherRepo
	userRepo     *repository.UserRepo
	hub          *ws.Hub
	dispatcher   *WebhookDispatcher
	automation   *AutomationEngine
}

func NewEvents(
	activityRepo *repository.ActivityRepo,
	notifRepo *repository.NotificationRepo,
	watcherRepo *repository.WatcherRepo,
	hub *ws.Hub,
	dispatcher *WebhookDispatcher,
	automation *AutomationEngine,
) *Events {
	return &Events{
		activityRepo: activityRepo,
		notifRepo:    notifRepo,
		watcherRepo:  watcherRepo,
		hub:          hub,
		dispatcher:   dispatcher,
		automation:   automation,
	}
}

// SetUserRepo wires the user repo so Notify can consult per-user
// notification preferences. Optional — kept out of the constructor to
// avoid breaking callers that don't care.
func (e *Events) SetUserRepo(u *repository.UserRepo) {
	if e != nil {
		e.userRepo = u
	}
}

// SetAutomation lets the engine be wired in after Events is built — it
// avoids a circular dependency where AutomationEngine needs Events but
// Events needs the engine to fan out.
func (e *Events) SetAutomation(a *AutomationEngine) {
	if e == nil {
		return
	}
	e.automation = a
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
	if e.dispatcher != nil {
		e.dispatcher.Enqueue(ctx, boardID, action, payload)
	}
	if e.automation != nil {
		e.automation.Handle(ctx, boardID, action, payload)
	}
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
		// Per-user opt-out: skip if the user has disabled this type.
		// Default is allow, so users without prefs still receive
		// everything.
		if e.userRepo != nil && !e.userRepo.WantsNotification(ctx, uid, notifType) {
			continue
		}
		if err := e.notifRepo.Create(ctx, uid, notifType, payload, sourceCardID, sourceBoardID); err != nil {
			log.Warn().Err(err).Str("type", notifType).Str("user", uid).Msg("notification create failed")
		}
	}
}

// NotifyCardWatchers fans out to everyone watching the card directly,
// the parent list, or the board it's on. Used for changes that watchers
// asked to hear about.
func (e *Events) NotifyCardWatchers(
	ctx context.Context,
	cardID, boardID, actorUserID, notifType string,
	payload interface{},
) {
	if e == nil || e.watcherRepo == nil {
		return
	}
	users, err := e.watcherRepo.WatchersForCard(ctx, cardID)
	if err != nil {
		return
	}
	e.Notify(ctx, users, actorUserID, notifType, cardID, boardID, payload)
}

// AutoWatchCard adds the user as a watcher of the card. Idempotent.
func (e *Events) AutoWatchCard(ctx context.Context, userID, cardID string) {
	if e == nil || e.watcherRepo == nil {
		return
	}
	_ = e.watcherRepo.Watch(ctx, userID, "card", cardID)
}
