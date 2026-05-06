package ws

import (
	"encoding/json"
	"sync"
	"time"
)

type Event struct {
	Type      string          `json:"type"`
	BoardID   string          `json:"board_id"`
	UserID    string          `json:"user_id"`
	Payload   json.RawMessage `json:"payload"`
	Timestamp time.Time       `json:"timestamp"`
}

// inbound is what we read off a client's socket and route through the
// hub's main loop. Plain string fields keep the wire shape simple.
type inbound struct {
	client     *Client
	Type       string `json:"type"`
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
}

type PresenceUser struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

type Hub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Event
	inboundCh  chan inbound

	// Presence: targetKey -> client -> user info. We key by *Client so
	// multiple tabs from the same user are tracked separately; the
	// frontend dedupes for display by user_id.
	presence       map[string]map[*Client]PresenceUser
	clientTargets  map[*Client]map[string]bool // clientID -> set of targetKeys (for cleanup)
}

func NewHub() *Hub {
	return &Hub{
		rooms:         make(map[string]map[*Client]struct{}),
		register:      make(chan *Client, 16),
		unregister:    make(chan *Client, 16),
		broadcast:     make(chan *Event, 64),
		inboundCh:     make(chan inbound, 64),
		presence:      make(map[string]map[*Client]PresenceUser),
		clientTargets: make(map[*Client]map[string]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[c.boardID]; !ok {
				h.rooms[c.boardID] = make(map[*Client]struct{})
			}
			h.rooms[c.boardID][c] = struct{}{}
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			// Clear any presence the client was holding before we drop it.
			leftTargets := make([]string, 0, len(h.clientTargets[c]))
			for tk := range h.clientTargets[c] {
				if room, ok := h.presence[tk]; ok {
					delete(room, c)
					if len(room) == 0 {
						delete(h.presence, tk)
					}
				}
				leftTargets = append(leftTargets, tk)
			}
			delete(h.clientTargets, c)

			if room, ok := h.rooms[c.boardID]; ok {
				if _, exists := room[c]; exists {
					delete(room, c)
					close(c.send)
					if len(room) == 0 {
						delete(h.rooms, c.boardID)
					}
				}
			}
			boardID := c.boardID
			h.mu.Unlock()

			// Re-broadcast presence state for any targets the client
			// held — has to happen after the mutex unlock.
			for _, tk := range leftTargets {
				h.sendPresenceState(boardID, tk)
			}

		case event := <-h.broadcast:
			h.dispatch(event)

		case msg := <-h.inboundCh:
			h.handleInbound(msg)
		}
	}
}

func (h *Hub) dispatch(event *Event) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	room := h.rooms[event.BoardID]
	for c := range room {
		select {
		case c.send <- data:
		default:
			go func(c *Client) { h.unregister <- c }(c)
		}
	}
}

func (h *Hub) handleInbound(m inbound) {
	switch m.Type {
	case "presence:join":
		key := presenceKey(m.TargetType, m.TargetID)
		h.mu.Lock()
		if _, ok := h.presence[key]; !ok {
			h.presence[key] = make(map[*Client]PresenceUser)
		}
		h.presence[key][m.client] = PresenceUser{
			UserID:      m.client.userID,
			DisplayName: m.client.displayName,
			AvatarURL:   m.client.avatarURL,
		}
		if _, ok := h.clientTargets[m.client]; !ok {
			h.clientTargets[m.client] = make(map[string]bool)
		}
		h.clientTargets[m.client][key] = true
		boardID := m.client.boardID
		h.mu.Unlock()
		h.sendPresenceState(boardID, key)

	case "presence:leave":
		key := presenceKey(m.TargetType, m.TargetID)
		h.mu.Lock()
		if room, ok := h.presence[key]; ok {
			delete(room, m.client)
			if len(room) == 0 {
				delete(h.presence, key)
			}
		}
		if targets, ok := h.clientTargets[m.client]; ok {
			delete(targets, key)
		}
		boardID := m.client.boardID
		h.mu.Unlock()
		h.sendPresenceState(boardID, key)

	case "typing:start", "typing:stop":
		// Pass-through with the user's identity attached.
		h.Broadcast(m.client.boardID, m.client.userID, m.Type, map[string]interface{}{
			"target_type":  m.TargetType,
			"target_id":    m.TargetID,
			"user_id":      m.client.userID,
			"display_name": m.client.displayName,
		})
	}
}

func presenceKey(targetType, targetID string) string {
	return targetType + ":" + targetID
}

// sendPresenceState fans out the current presence list for one target
// to every subscriber of the target's board.
func (h *Hub) sendPresenceState(boardID, targetKey string) {
	h.mu.RLock()
	users := make([]PresenceUser, 0, len(h.presence[targetKey]))
	for _, u := range h.presence[targetKey] {
		users = append(users, u)
	}
	h.mu.RUnlock()

	parts := splitOnce(targetKey, ':')
	h.Broadcast(boardID, "", "presence:state", map[string]interface{}{
		"target_type": parts[0],
		"target_id":   parts[1],
		"users":       users,
	})
}

func splitOnce(s string, sep byte) [2]string {
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			return [2]string{s[:i], s[i+1:]}
		}
	}
	return [2]string{s, ""}
}

func (h *Hub) Register(c *Client) {
	h.register <- c
}

func (h *Hub) Unregister(c *Client) {
	h.unregister <- c
}

// Inbound is called by the client read pump for any message that
// originates from the browser side.
func (h *Hub) Inbound(c *Client, raw []byte) {
	var m inbound
	if err := json.Unmarshal(raw, &m); err != nil {
		return
	}
	if m.Type == "" {
		return
	}
	m.client = c
	select {
	case h.inboundCh <- m:
	default:
		// Drop on overflow — these are advisory, not authoritative.
	}
}

func (h *Hub) Broadcast(boardID, userID, eventType string, payload interface{}) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.broadcast <- &Event{
		Type:      eventType,
		BoardID:   boardID,
		UserID:    userID,
		Payload:   raw,
		Timestamp: time.Now(),
	}
}
