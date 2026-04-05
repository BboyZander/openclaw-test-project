const el = (id) => document.getElementById(id);

// Tabs / screens
const tabNew = el('tabNew');
const tabList = el('tabList');
const screenForm = el('screenForm');
const screenList = el('screenList');

// Banner
const banner = el('statusBanner');

// Form
const form = el('bookingForm');
const formTitle = el('formTitle');
const formHint = el('formHint');
const submitBtn = el('submitBtn');
const aiReviewBtn = el('aiReviewBtn');
const cancelEditBtn = el('cancelEditBtn');
const successState = el('successState');
const resetBtn = el('resetBtn');

// AI panel
const aiPanel = el('aiPanel');
const aiReviewMeta = el('aiReviewMeta');
const suggestionsList = el('suggestionsList');
const warningsList = el('warningsList');

// List
const refreshListBtn = el('refreshListBtn');
const bookingsList = el('bookingsList');
const emptyList = el('emptyList');

const fields = [...form.elements].filter((node) => node && node.name);

const state = {
  mode: 'create', // create | edit
  editingId: null,
};

function setBanner(message, type = '') {
  banner.textContent = message;
  banner.className = `banner ${type}`.trim();
  banner.hidden = !message;
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  aiReviewBtn.disabled = isBusy;
  cancelEditBtn.disabled = isBusy;
  fields.forEach((field) => (field.disabled = isBusy));
}

function clearFieldErrors() {
  document.querySelectorAll('.field, .fieldset').forEach((node) => node.classList.remove('invalid'));
  document.querySelectorAll('[data-error-for]').forEach((node) => (node.textContent = ''));
}

function setFieldError(name, message) {
  const target = document.querySelector(`[data-error-for="${name}"]`);
  const field = form.querySelector(`[name="${name}"]`)?.closest('.field, .fieldset');
  if (field) field.classList.add('invalid');
  if (target) target.textContent = message;
}

function showErrors(errors) {
  clearFieldErrors();
  Object.entries(errors).forEach(([field, message]) => setFieldError(field, message));
  setBanner('Проверьте подсвеченные поля.', 'error');
}

function showServerErrors(payload) {
  clearFieldErrors();
  const fieldErrors = payload?.error?.details?.fieldErrors || payload?.details?.fieldErrors || {};
  Object.entries(fieldErrors).forEach(([field, message]) => {
    // Сервер возвращает коды, UI показывает русские подсказки.
    setFieldError(field, mapServerFieldError(field, message));
  });
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  setBanner(hasFieldErrors ? 'Проверка на сервере не прошла — исправьте поля.' : 'Ошибка на сервере.', 'error');
}

function mapServerFieldError(field, code) {
  const common = {
    required: 'Поле обязательно.',
    invalid_format: 'Неверный формат.',
    not_allowed: 'Недопустимое значение.',
    in_past: 'Дата не может быть в прошлом.',
    max_length: 'Слишком длинный текст.',
    must_be_true: 'Нужно подтвердить согласие.',
  };
  if (common[code]) return common[code];
  // fallback
  return `Ошибка: ${code}`;
}

function getValues() {
  const data = new FormData(form);
  return {
    name: String(data.get('name') || '').trim(),
    email: String(data.get('email') || '').trim(),
    date: String(data.get('date') || ''),
    duration_minutes: Number(data.get('duration_minutes') || 0),
    format: String(data.get('format') || ''),
    comment: String(data.get('comment') || '').trim(),
    consent: data.get('consent') === 'on',
  };
}

function validate(values) {
  const errors = {};
  if (!values.name) errors.name = 'Укажите имя.';

  if (!values.email) errors.email = 'Укажите email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Введите корректный email.';

  if (!values.date) errors.date = 'Укажите дату.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = 'Формат даты: ГГГГ-ММ-ДД.';
  else {
    const selected = new Date(`${values.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) errors.date = 'Дата должна быть сегодня или позже.';
  }

  if (![30, 60, 90].includes(values.duration_minutes)) errors.duration_minutes = 'Выберите 30, 60 или 90 минут.';
  if (!['audio', 'video'].includes(values.format)) errors.format = 'Выберите аудио или видео.';
  if (values.comment.length > 2000) errors.comment = 'Комментарий — не более 2000 символов.';
  if (!values.consent) errors.consent = 'Нужно согласие перед отправкой.';
  return errors;
}

function renderReview(title, payload) {
  aiPanel.hidden = false;
  aiReviewMeta.textContent = title;

  suggestionsList.innerHTML = '';
  warningsList.innerHTML = '';

  for (const item of payload.suggestions || []) {
    const li = document.createElement('li');
    if (typeof item === 'string') li.textContent = item;
    else {
      const field = item.field ? `${item.field}: ` : '';
      const value = item.value !== undefined ? JSON.stringify(item.value) : '';
      const conf = item.confidence !== undefined ? ` (conf ${item.confidence})` : '';
      const reason = item.reason ? ` — ${item.reason}` : '';
      li.textContent = `${field}${value}${conf}${reason}`.trim();
    }
    suggestionsList.appendChild(li);
  }

  for (const item of payload.warnings || []) {
    const li = document.createElement('li');
    if (typeof item === 'string') li.textContent = item;
    else {
      const code = item.code ? `${item.code}: ` : '';
      li.textContent = `${code}${item.message || ''}`.trim();
    }
    warningsList.appendChild(li);
  }

  if (!payload.suggestions?.length) suggestionsList.innerHTML = '<li>Нет рекомендаций.</li>';
  if (!payload.warnings?.length) warningsList.innerHTML = '<li>Нет предупреждений.</li>';
}

function setTab(active) {
  const isNew = active === 'new';
  tabNew.classList.toggle('is-active', isNew);
  tabList.classList.toggle('is-active', !isNew);

  screenForm.hidden = !isNew;
  screenList.hidden = isNew;
}

function resetToCreateMode() {
  state.mode = 'create';
  state.editingId = null;

  formTitle.textContent = 'Новая заявка';
  formHint.textContent = 'Заполните форму, чтобы отправить заявку на бронирование.';
  submitBtn.textContent = 'Отправить';
  cancelEditBtn.hidden = true;

  form.reset();
  form.hidden = false;
  successState.hidden = true;
  aiPanel.hidden = true;
  clearFieldErrors();
  setBanner('');
}

function setEditMode(item) {
  state.mode = 'edit';
  state.editingId = item.id;

  formTitle.textContent = 'Редактирование заявки';
  formHint.textContent = `ID: ${item.id}`;
  submitBtn.textContent = 'Сохранить';
  cancelEditBtn.hidden = false;

  form.hidden = false;
  successState.hidden = true;
  aiPanel.hidden = true;

  // Fill fields
  form.elements.name.value = item.name ?? '';
  form.elements.email.value = item.email ?? '';
  form.elements.date.value = item.date ?? '';
  form.elements.duration_minutes.value = String(item.duration_minutes ?? '');
  form.elements.format.value = item.format ?? '';
  form.elements.comment.value = item.comment ?? '';
  form.elements.consent.checked = item.consent === true;

  clearFieldErrors();
  setBanner('Вы редактируете существующую заявку.', '');
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

function formatFormat(v) {
  return v === 'audio' ? 'Аудио' : v === 'video' ? 'Видео' : String(v || '—');
}

function renderBookingCard(item) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'bookingCard';
  card.setAttribute('aria-label', `Открыть заявку ${item.id}`);

  const title = document.createElement('div');
  title.className = 'bookingCard__title';
  title.textContent = item.name || 'Без имени';

  const meta = document.createElement('div');
  meta.className = 'bookingCard__meta';
  const status = item.status ? `Статус: ${item.status}` : 'Статус: —';
  meta.textContent = `${item.date || '—'} • ${formatFormat(item.format)} • ${item.duration_minutes || '—'} мин • ${status}`;

  const sub = document.createElement('div');
  sub.className = 'bookingCard__sub';
  sub.textContent = item.email || '';

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(sub);

  card.addEventListener('click', async () => {
    setBusy(true);
    setBanner('Загружаю заявку…');
    try {
      const { response, data } = await apiJson(`/api/booking-requests/${encodeURIComponent(item.id)}`, { method: 'GET' });
      if (!response.ok) throw new Error(`GET failed ${response.status}`);
      setTab('new');
      setEditMode(data.item);
      setBanner('');
    } catch (e) {
      setBanner('Не удалось загрузить заявку. Попробуйте ещё раз.', 'error');
    } finally {
      setBusy(false);
    }
  });

  return card;
}

async function loadList() {
  bookingsList.innerHTML = '';
  emptyList.hidden = true;

  setBusy(true);
  setBanner('Загружаю список…');

  try {
    const { response, data } = await apiJson('/api/booking-requests', { method: 'GET', headers: {} });
    if (!response.ok) throw new Error(`List failed ${response.status}`);

    const items = data?.items || [];
    if (!items.length) {
      emptyList.hidden = false;
      setBanner('');
      return;
    }

    for (const item of items) bookingsList.appendChild(renderBookingCard(item));
    setBanner('');
  } catch (e) {
    setBanner('Не удалось загрузить список заявок.', 'error');
  } finally {
    setBusy(false);
  }
}

// Tabs events
	abNew.addEventListener('click', () => {
  setTab('new');
});
	tabList.addEventListener('click', async () => {
  setTab('list');
  await loadList();
});

refreshListBtn.addEventListener('click', loadList);

cancelEditBtn.addEventListener('click', () => {
  resetToCreateMode();
});

// Form submit
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  successState.hidden = true;
  aiPanel.hidden = true;

  const values = getValues();
  const clientErrors = validate(values);
  if (Object.keys(clientErrors).length) {
    showErrors(clientErrors);
    return;
  }

  setBusy(true);
  clearFieldErrors();

  const isEdit = state.mode === 'edit' && state.editingId;
  setBanner(isEdit ? 'Сохраняю изменения…' : 'Отправляю заявку…');

  try {
    const url = isEdit ? `/api/booking-requests/${encodeURIComponent(state.editingId)}` : '/api/booking-requests';
    const method = isEdit ? 'PUT' : 'POST';

    const { response, data } = await apiJson(url, {
      method,
      body: JSON.stringify(values),
    });

    if (response.status === 422) {
      showServerErrors(data);
      return;
    }

    if (response.status === 404) {
      setBanner('Заявка не найдена (возможно, сервер перезапускался).', 'error');
      return;
    }

    if (!response.ok) throw new Error(`Request failed (${response.status})`);

    if (isEdit) {
      setBanner('Изменения сохранены.', 'success');
      // после редактирования возвращаемся к списку
      setTab('list');
      await loadList();
    } else {
      form.hidden = true;
      aiPanel.hidden = true;
      successState.hidden = false;
      setBanner('Заявка отправлена.', 'success');
    }
  } catch (error) {
    setBanner('Не удалось отправить запрос. Попробуйте ещё раз.', 'error');
  } finally {
    setBusy(false);
  }
});

// AI review
aiReviewBtn.addEventListener('click', async () => {
  const values = getValues();
  const clientErrors = validate(values);
  if (Object.keys(clientErrors).length) {
    showErrors(clientErrors);
    return;
  }

  setBusy(true);
  setBanner('Запускаю AI-проверку…');

  try {
    const { response, data } = await apiJson('/api/booking-requests/ai-review', {
      method: 'POST',
      body: JSON.stringify(values),
    });

    if (!response.ok) throw new Error(`AI review failed (${response.status})`);

    renderReview('Рекомендации и предупреждения на основе текущего состояния формы.', data);
    setBanner('AI-проверка завершена.', 'success');
  } catch (error) {
    setBanner('AI-проверка сейчас недоступна.', 'error');
  } finally {
    setBusy(false);
  }
});

resetBtn.addEventListener('click', () => {
  resetToCreateMode();
});

for (const input of fields) {
  input.addEventListener('blur', () => {
    const errors = validate(getValues());
    if (errors[input.name]) setFieldError(input.name, errors[input.name]);
  });
}

// Init
resetToCreateMode();
setTab('new');
