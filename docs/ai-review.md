# Booking Requests AI Review

`POST /api/booking-requests/ai-review` analyses a booking draft and returns a strict JSON payload.

## Request

Send the current draft form state as JSON:

```json
{
  "name": "Ada Lovelace",
  "email": "ADA@EXAMPLE.COM",
  "date": "2030-01-01T10:00:00Z",
  "duration_minutes": 45,
  "format": "video",
  "comment": "Looking for a quick demo.",
  "consent": true
}
```

## Response

The endpoint always returns this shape:

```json
{
  "suggestions": [
    {
      "field": "email",
      "value": "ada@example.com",
      "confidence": 0.97,
      "reason": "Normalize email to lowercase."
    }
  ],
  "warnings": [
    {
      "code": "unsupported_duration_minutes",
      "message": "Duration should be 30, 60, or 90 minutes."
    }
  ]
}
```

## Behavior

- No external model keys are required.
- The implementation is rule-based only.
- The response contract stays stable even if no suggestions or warnings are produced.
- Unknown or unsafe assumptions are not invented; the review only reports what can be inferred from the draft.

## Example

```bash
curl -sS -X POST http://localhost:3000/api/booking-requests/ai-review \
  -H 'content-type: application/json' \
  -d '{
    "name": "Ada Lovelace",
    "email": "ADA@EXAMPLE.COM",
    "date": "2030-01-01T10:00:00Z",
    "duration_minutes": 45,
    "format": "video",
    "comment": "Looking for a quick demo.",
    "consent": true
  }' | jq
```

Expected result:

```json
{
  "suggestions": [
    {
      "field": "email",
      "value": "ada@example.com",
      "confidence": 0.97,
      "reason": "Normalize email to lowercase."
    },
    {
      "field": "duration_minutes",
      "value": 60,
      "confidence": 0.72,
      "reason": "Closest supported duration."
    }
  ],
  "warnings": []
}
```
