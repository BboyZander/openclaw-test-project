import express from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve a tiny static frontend from repo root (index.html + main.js + styles.css)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
app.use(express.static(rootDir));

/**
 * In-memory storage.
 * NOTE: Replaced on restart; good enough for the assignment.
 */
const bookingRequests = new Map();

function validationFailed(res, fieldErrors) {
  return res.status(422).json({
    error: {
      code: 'validation_failed',
      details: {
        fieldErrors,
      },
    },
  });
}

function notFound(res) {
  return res.status(404).json({
    error: {
      code: 'not_found',
      message: 'Заявка не найдена',
    },
  });
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // Pragmatic email validation; sufficient for form input.
  // Disallows spaces, requires one @ and at least one dot in domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseDate(value) {
  // FE contract: YYYY-MM-DD (no time)
  if (typeof value !== 'string') return { ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false };
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, date: d };
}

function isPast(date) {
  return date.getTime() < Date.now();
}

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDraft(body) {
  return {
    name: toTrimmedString(body.name),
    email: toTrimmedString(body.email),
    date: toTrimmedString(body.date),
    duration_minutes:
      body.duration_minutes === undefined || body.duration_minutes === null || body.duration_minutes === ''
        ? ''
        : body.duration_minutes,
    format: toTrimmedString(body.format),
    comment: toTrimmedString(body.comment),
    consent: body.consent === true,
  };
}

function pushSuggestion(target, field, value, confidence, reason) {
  target.push({ field, value, confidence, reason });
}

function pushWarning(target, code, message) {
  target.push({ code, message });
}

function buildAiReview(draft) {
  const suggestions = [];
  const warnings = [];

  if (!draft.name) {
    pushWarning(warnings, 'missing_name', 'Не указано имя.');
  }

  if (!draft.email) {
    pushWarning(warnings, 'missing_email', 'Не указан email.');
  } else if (!isValidEmail(draft.email)) {
    pushWarning(warnings, 'invalid_email', 'Email выглядит некорректно.');
  } else {
    const normalized = draft.email.toLowerCase();
    if (normalized !== draft.email) {
      pushSuggestion(suggestions, 'email', normalized, 0.97, 'Нормализовать email в нижний регистр.');
    }
  }

  if (!draft.date) {
    pushWarning(warnings, 'missing_date', 'Не указана дата.');
  } else {
    const parsed = parseDate(draft.date);
    if (!parsed.ok) {
      pushWarning(warnings, 'invalid_date', 'Дата должна быть в формате YYYY-MM-DD.');
    } else if (isPast(parsed.date)) {
      pushWarning(warnings, 'date_in_past', 'Выбранная дата в прошлом.');
    }
  }

  const allowedDurations = [30, 60, 90];
  if (draft.duration_minutes === '') {
    pushWarning(warnings, 'missing_duration_minutes', 'Не указана длительность.');
  } else {
    const n = typeof draft.duration_minutes === 'number' ? draft.duration_minutes : Number(draft.duration_minutes);
    if (!Number.isInteger(n)) {
      pushWarning(warnings, 'invalid_duration_minutes', 'Длительность должна быть целым числом.');
    } else if (!allowedDurations.includes(n)) {
      pushWarning(warnings, 'unsupported_duration_minutes', 'Длительность должна быть 30, 60 или 90 минут.');
      const closest = allowedDurations.reduce(
        (prev, current) => (Math.abs(current - n) < Math.abs(prev - n) ? current : prev),
        allowedDurations[0],
      );
      pushSuggestion(suggestions, 'duration_minutes', closest, 0.72, 'Ближайшее поддерживаемое значение.');
    }
  }

  const allowedFormats = new Set(['audio', 'video']);
  if (!draft.format) {
    pushWarning(warnings, 'missing_format', 'Не указан формат.');
  } else if (!allowedFormats.has(draft.format)) {
    pushWarning(warnings, 'unsupported_format', 'Формат должен быть audio или video.');
  }

  if (draft.comment.length > 2000) {
    pushWarning(warnings, 'comment_too_long', 'Комментарий слишком длинный.');
  }

  if (!draft.consent) {
    pushWarning(warnings, 'consent_required', 'Необходимо согласие перед отправкой.');
  }

  return { suggestions, warnings };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

function validateBookingPayload(body) {
  const fieldErrors = {};

  // required: name
  if (!isNonEmptyString(body.name)) fieldErrors.name = 'required';

  // required + format: email
  if (!isNonEmptyString(body.email)) fieldErrors.email = 'required';
  else if (!isValidEmail(body.email.trim())) fieldErrors.email = 'invalid_format';

  // required + not in past: date
  if (!isNonEmptyString(body.date)) {
    fieldErrors.date = 'required';
  } else {
    const parsed = parseDate(body.date);
    if (!parsed.ok) fieldErrors.date = 'invalid_format';
    else if (isPast(parsed.date)) fieldErrors.date = 'in_past';
  }

  // required + allowlist: duration_minutes
  const allowedDurations = new Set([30, 60, 90]);
  if (body.duration_minutes === undefined || body.duration_minutes === null || body.duration_minutes === '') {
    fieldErrors.duration_minutes = 'required';
  } else {
    const n = typeof body.duration_minutes === 'number' ? body.duration_minutes : Number(body.duration_minutes);
    if (!Number.isInteger(n)) fieldErrors.duration_minutes = 'invalid_format';
    else if (!allowedDurations.has(n)) fieldErrors.duration_minutes = 'not_allowed';
  }

  // required + allowlist: format
  const allowedFormats = new Set(['audio', 'video']);
  if (!isNonEmptyString(body.format)) fieldErrors.format = 'required';
  else if (!allowedFormats.has(body.format)) fieldErrors.format = 'not_allowed';

  // comment maxLen 2000 (optional)
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') fieldErrors.comment = 'invalid_format';
    else if (body.comment.length > 2000) fieldErrors.comment = 'max_length';
  }

  // consent must be true
  if (body.consent !== true) fieldErrors.consent = 'must_be_true';

  return fieldErrors;
}

function toBookingRecord(id, createdAt, updatedAt, body) {
  return {
    id,
    status: 'new',
    created_at: createdAt,
    updated_at: updatedAt,
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    date: body.date,
    duration_minutes: typeof body.duration_minutes === 'number' ? body.duration_minutes : Number(body.duration_minutes),
    format: body.format,
    comment: body.comment ?? null,
    consent: true,
  };
}

app.get('/api/booking-requests', (req, res) => {
  const items = Array.from(bookingRequests.values()).sort((a, b) => {
    // newest first
    if (a.created_at > b.created_at) return -1;
    if (a.created_at < b.created_at) return 1;
    return 0;
  });
  return res.json({ items });
});

app.get('/api/booking-requests/:id', (req, res) => {
  const item = bookingRequests.get(req.params.id);
  if (!item) return notFound(res);
  return res.json({ item });
});

app.post('/api/booking-requests', (req, res) => {
  const body = req.body ?? {};
  const fieldErrors = validateBookingPayload(body);

  if (Object.keys(fieldErrors).length > 0) {
    return validationFailed(res, fieldErrors);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const record = toBookingRecord(id, now, now, body);

  bookingRequests.set(id, record);

  return res.status(201).json({
    id: record.id,
    status: record.status,
    created_at: record.created_at,
  });
});

app.put('/api/booking-requests/:id', (req, res) => {
  const id = req.params.id;
  const existing = bookingRequests.get(id);
  if (!existing) return notFound(res);

  const body = req.body ?? {};
  const fieldErrors = validateBookingPayload(body);
  if (Object.keys(fieldErrors).length > 0) {
    return validationFailed(res, fieldErrors);
  }

  const updatedAt = new Date().toISOString();
  const record = toBookingRecord(existing.id, existing.created_at, updatedAt, body);
  bookingRequests.set(id, record);

  return res.json({ item: record });
});

app.post('/api/booking-requests/ai-review', (req, res) => {
  const draft = normalizeDraft(req.body ?? {});
  const review = buildAiReview(draft);
  return res.json(review);
});

// Basic JSON parse error handling (malformed JSON)
// Express throws a SyntaxError before reaching routes.
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'bad_json',
        message: 'Некорректный JSON в теле запроса',
      },
    });
  }
  return next(err);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Booking API listening on http://localhost:${PORT}`);
});
