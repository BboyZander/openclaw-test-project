# openclaw-test-project

Minimal Booking Requests API.

## Run

```bash
npm install
npm start
# listens on :3000 by default
```

## Endpoints

- `GET /api/health` → `{ "ok": true }`
- `POST /api/booking-requests` → creates a booking request

### Example

```bash
curl -sS -X POST http://localhost:3000/api/booking-requests \
  -H 'content-type: application/json' \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "date": "2030-01-01T10:00:00Z",
    "duration_minutes": 60,
    "format": "video",
    "comment": "Looking for a quick demo.",
    "consent": true
  }' | jq
```
