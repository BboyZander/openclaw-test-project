# FE ↔ BE контракт (MVP) — Booking Requests v2

Цель: минимальный стабильный контракт для UI (форма + список/редактирование) и API.

## Модель данных (BookingRequest)

### Поля
- `id: string` (UUID)
- `status: "new" | "in_progress" | "done"` *(MVP: всегда `new`, но поле сохранено для расширения)*
- `created_at: string` (ISO-8601 datetime)
- `updated_at: string` (ISO-8601 datetime)
- `name: string`
- `email: string` *(на сервере нормализуется в lower-case)*
- `date: string` *(формат `YYYY-MM-DD`, без времени)*
- `duration_minutes: 30 | 60 | 90`
- `format: "audio" | "video"`
- `comment: string | null`
- `consent: true` *(для MVP обязательно true)*

## Endpoints

### 1) Health
**GET** `/api/health`

**200**
```json
{ "ok": true }
```

### 2) Создание заявки
**POST** `/api/booking-requests`

**Request**
```json
{
  "name": "...",
  "email": "...",
  "date": "2026-04-05",
  "duration_minutes": 60,
  "format": "audio",
  "comment": "...", 
  "consent": true
}
```

**201**
```json
{ "id": "...", "status": "new", "created_at": "..." }
```

**422** (валидация)
```json
{
  "error": {
    "code": "validation_failed",
    "details": {
      "fieldErrors": {
        "name": "required",
        "email": "invalid_format",
        "date": "in_past",
        "duration_minutes": "not_allowed",
        "format": "not_allowed",
        "comment": "max_length",
        "consent": "must_be_true"
      }
    }
  }
}
```

### 3) Список заявок
**GET** `/api/booking-requests`

**200**
```json
{ "items": [/* BookingRequest */] }
```

### 4) Получение заявки
**GET** `/api/booking-requests/:id`

**200**
```json
{ "item": {/* BookingRequest */} }
```

**404**
```json
{ "error": { "code": "not_found", "message": "Заявка не найдена" } }
```

### 5) Обновление заявки (редактирование)
**PUT** `/api/booking-requests/:id`

**Request**: те же поля, что и для POST.

**200**
```json
{ "item": {/* BookingRequest */} }
```

**404**: как выше.

**422**: как выше.

## Ошибки (общие правила)
- Ошибки возвращаются в виде `{ error: { code, message?, details? } }`.
- Для валидации: HTTP 422 + `error.code = "validation_failed"` + `details.fieldErrors`.

## Границы MVP
Входит:
- русскоязычный UI;
- 2 экрана: "Новая заявка" и "Заявки";
- список заявок (карточки), открытие и редактирование заявки;
- backend CRUD (create/list/get/update) в памяти.

Не входит:
- авторизация/роли/права;
- пагинация/фильтры/поиск;
- персистентное хранилище (БД);
- статусы/воркфлоу кроме отображения поля.
