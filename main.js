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
const fillExampleBtn = el('fillExampleBtn');
const cancelEditBtn = el('cancelEditBtn');
const successState = el('successState');
const resetBtn = el('resetBtn');

// Datepicker
const dateInput = el('dateInput');
const datePickerBtn = el('datePickerBtn');
const datePicker = el('datePicker');

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
  fillExampleBtn.disabled = isBusy;
  cancelEditBtn.disabled = isBusy;
  refreshListBtn.disabled = isBusy;
  tabNew.disabled = isBusy;
  tabList.disabled = isBusy;
  datePickerBtn.disabled = isBusy;
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
    setFieldError(field, mapServerFieldError(message));
  });
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  setBanner(hasFieldErrors ? 'Проверка на сервере не прошла — исправьте поля.' : 'Ошибка на сервере.', 'error');
}

function mapServerFieldError(code) {
  const common = {
    required: 'Поле обязательно.',
    invalid_format: 'Неверный формат.',
    not_allowed: 'Недопустимое значение.',
    in_past: 'Дата не может быть в прошлом.',
    max_length: 'Слишком длинный текст.',
    must_be_true: 'Нужно подтвердить согласие.',
  };
  return common[code] || `Ошибка: ${code}`;
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
    } catch {
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
  } catch {
    setBanner('Не удалось загрузить список заявок.', 'error');
  } finally {
    setBusy(false);
  }
}

// ----- Test data -----
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function isoDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fillExample() {
  const first = pick(['Алексей', 'Мария', 'Ирина', 'Дмитрий', 'Светлана', 'Никита', 'Екатерина']);
  const last = pick(['Иванов', 'Петрова', 'Смирнов', 'Кузнецова', 'Соколов', 'Попова']);
  const n = randInt(10, 99);
  const domains = ['example.com', 'mail.test', 'demo.local'];

  const daysAhead = randInt(1, 30);
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);

  form.elements.name.value = `${first} ${last}`;
  form.elements.email.value = `${first.toLowerCase()}.${last.toLowerCase()}${n}@${pick(domains)}`;
  form.elements.date.value = isoDateYYYYMMDD(d);
  form.elements.duration_minutes.value = String(pick([30, 60, 90]));
  form.elements.format.value = pick(['audio', 'video']);
  form.elements.comment.value = pick([
    'Хочу записать интервью на 2 микрофона.',
    'Нужен видеосвет и тихая комната.',
    'Это тестовая заявка для проверки формы.',
    '',
  ]);
  form.elements.consent.checked = true;

  clearFieldErrors();
  setBanner('Форма заполнена тестовыми данными.', 'success');
}

// ----- Datepicker (lightweight, no deps) -----
let dpMonth = new Date();

function clampToStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseYYYYMMDD(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function openDatePicker() {
  datePicker.hidden = false;
  const current = parseYYYYMMDD(dateInput.value);
  dpMonth = current ? new Date(current) : new Date();
  dpMonth.setDate(1);
  renderDatePicker();
}

function closeDatePicker() {
  datePicker.hidden = true;
}

function renderDatePicker() {
  const month = dpMonth.getMonth();
  const year = dpMonth.getFullYear();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const startWeekday = (first.getDay() + 6) % 7; // Mon=0
  const totalDays = last.getDate();

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekday = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const selected = parseYYYYMMDD(dateInput.value);
  const selectedKey = selected ? isoDateYYYYMMDD(selected) : null;

  datePicker.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'datepicker__header';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'btn btn--ghost datepicker__nav';
  prev.textContent = '‹';
  prev.addEventListener('click', () => {
    dpMonth = new Date(year, month - 1, 1);
    renderDatePicker();
  });

  const title = document.createElement('div');
  title.className = 'datepicker__title';
  title.textContent = `${monthNames[month]} ${year}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn--ghost datepicker__nav';
  next.textContent = '›';
  next.addEventListener('click', () => {
    dpMonth = new Date(year, month + 1, 1);
    renderDatePicker();
  });

  header.appendChild(prev);
  header.appendChild(title);
  header.appendChild(next);

  const grid = document.createElement('div');
  grid.className = 'datepicker__grid';

  for (const wd of weekday) {
    const cell = document.createElement('div');
    cell.className = 'datepicker__wd';
    cell.textContent = wd;
    grid.appendChild(cell);
  }

  // empty cells
  for (let i = 0; i < startWeekday; i++) {
    const cell = document.createElement('div');
    cell.className = 'datepicker__empty';
    grid.appendChild(cell);
  }

  const today = clampToStartOfDay(new Date());
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const key = isoDateYYYYMMDD(d);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'datepicker__day';
    btn.textContent = String(day);

    if (key === selectedKey) btn.classList.add('is-selected');
    if (clampToStartOfDay(d) < today) btn.classList.add('is-disabled');

    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-disabled')) return;
      dateInput.value = key;
      closeDatePicker();
      // revalidate on pick
      const errors = validate(getValues());
      if (errors.date) setFieldError('date', errors.date);
      else setFieldError('date', '');
    });

    grid.appendChild(btn);
  }

  datePicker.appendChild(header);
  datePicker.appendChild(grid);
}

// ----- Events -----

tabNew.addEventListener('click', () => {
  setTab('new');
});

// fix #1: make sure tabList reliably switches + loads
// (previous code had a typo causing runtime error)
tabList.addEventListener('click', async () => {
  setTab('list');
  await loadList();
});

refreshListBtn.addEventListener('click', loadList);

cancelEditBtn.addEventListener('click', () => {
  resetToCreateMode();
});

fillExampleBtn.addEventListener('click', () => {
  fillExample();
});

// Datepicker
function toggleDatePicker() {
  if (datePicker.hidden) openDatePicker();
  else closeDatePicker();
}

datePickerBtn.addEventListener('click', (e) => {
  e.preventDefault();
  toggleDatePicker();
});

dateInput.addEventListener('focus', () => {
  // show on focus for better UX
  openDatePicker();
});

document.addEventListener('click', (e) => {
  if (datePicker.hidden) return;
  const target = e.target;
  if (target === datePicker || datePicker.contains(target)) return;
  if (target === dateInput || target === datePickerBtn) return;
  closeDatePicker();
});

// Form submit
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  successState.hidden = true;

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
      setTab('list');
      await loadList();
    } else {
      form.hidden = true;
      successState.hidden = false;
      setBanner('Заявка отправлена.', 'success');
    }
  } catch {
    setBanner('Не удалось отправить запрос. Попробуйте ещё раз.', 'error');
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
setBanner('');
