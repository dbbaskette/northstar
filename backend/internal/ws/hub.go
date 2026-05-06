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

type Hub struct {
	mu      sync.RWMutex
	rooms   map[string]map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
	broadcast  chan *Event
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]struct{}),
		register:   make(chan *Client, 16),
		unregister: make(chan *Client, 16),
		broadcast:  make(chan *Event, 64),
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
			if room, ok := h.rooms[c.boardID]; ok {
				if _, exists := room[c]; exists {
					delete(room, c)
					close(c.send)
					if len(room) == 0 {
						delete(h.rooms, c.boardID)
					}
				}
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			h.mu.RLock()
			room := h.rooms[event.BoardID]
			for c := range room {
				select {
				case c.send <- data:
				default:
					// Client send buffer full — drop the client
					go func(c *Client) { h.unregister <- c }(c)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(c *Client) {
	h.register <- c
}

func (h *Hub) Unregister(c *Client) {
	h.unregister <- c
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
