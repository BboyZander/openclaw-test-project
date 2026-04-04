const form = document.getElementById('bookingForm');
const banner = document.getElementById('statusBanner');
const submitBtn = document.getElementById('submitBtn');
const aiReviewBtn = document.getElementById('aiReviewBtn');
const aiPanel = document.getElementById('aiPanel');
const aiReviewMeta = document.getElementById('aiReviewMeta');
const suggestionsList = document.getElementById('suggestionsList');
const warningsList = document.getElementById('warningsList');
const successState = document.getElementById('successState');
const resetBtn = document.getElementById('resetBtn');
const fields = [...form.elements].filter((el) => el.name);
function setBanner(message, type = '') { banner.textContent = message; banner.className = `banner ${type}`.trim(); banner.hidden = !message; }
function clearFieldErrors() { document.querySelectorAll('.field, .fieldset').forEach((el) => el.classList.remove('invalid')); document.querySelectorAll('[data-error-for]').forEach((node) => (node.textContent = '')); }
function setFieldError(name, message) { const target = document.querySelector(`[data-error-for="${name}"]`); const field = form.querySelector(`[name="${name}"]`)?.closest('.field, .fieldset'); if (field) field.classList.add('invalid'); if (target) target.textContent = message; }
function getValues() { const data = new FormData(form); return { name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim(), date: String(data.get('date') || ''), duration_minutes: Number(data.get('duration_minutes') || 0), format: String(data.get('format') || ''), comment: String(data.get('comment') || '').trim(), consent: data.get('consent') === 'on' }; }
function validate(values) { const errors = {}; if (!values.name) errors.name = 'Name is required.'; if (!values.email) errors.email = 'Email is required.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Enter a valid email address.'; if (!values.date) errors.date = 'Date is required.'; else { const selected = new Date(`${values.date}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); if (selected < today) errors.date = 'Date must be today or later.'; } if (![30, 60, 90].includes(values.duration_minutes)) errors.duration_minutes = 'Choose 30, 60, or 90 minutes.'; if (!['audio', 'video'].includes(values.format)) errors.format = 'Choose audio or video.'; if (values.comment.length > 2000) errors.comment = 'Comment must be 2000 characters or less.'; if (!values.consent) errors.consent = 'You must agree before submitting.'; return errors; }
function renderReview(section, payload) { aiPanel.hidden = false; aiReviewMeta.textContent = section; suggestionsList.innerHTML = ''; warningsList.innerHTML = ''; for (const item of payload.suggestions || []) {
    const li = document.createElement('li');
    if (typeof item === 'string') {
      li.textContent = item;
    } else {
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
    if (typeof item === 'string') {
      li.textContent = item;
    } else {
      const code = item.code ? `${item.code}: ` : '';
      li.textContent = `${code}${item.message || ''}`.trim();
    }
    warningsList.appendChild(li);
  } if (!payload.suggestions?.length) suggestionsList.innerHTML = '<li>No suggestions.</li>'; if (!payload.warnings?.length) warningsList.innerHTML = '<li>No warnings.</li>'; }
function setBusy(isBusy) { submitBtn.disabled = isBusy; aiReviewBtn.disabled = isBusy; fields.forEach((field) => (field.disabled = isBusy)); }
function showErrors(errors) { clearFieldErrors(); Object.entries(errors).forEach(([field, message]) => setFieldError(field, message)); setBanner('Please fix the highlighted fields.', 'error'); }
function showServerErrors(details) { clearFieldErrors(); const fieldErrors = details?.fieldErrors || {}; Object.entries(fieldErrors).forEach(([field, message]) => setFieldError(field, message)); const hasFieldErrors = Object.keys(fieldErrors).length > 0; setBanner(hasFieldErrors ? 'Server validation failed. Review the fields below.' : 'Request failed on the server.', 'error'); }
form.addEventListener('submit', async (event) => { event.preventDefault(); successState.hidden = true; aiPanel.hidden = true; const values = getValues(); const clientErrors = validate(values); if (Object.keys(clientErrors).length) { showErrors(clientErrors); return; } setBusy(true); setBanner('Submitting request…'); clearFieldErrors(); try { const response = await fetch('/api/booking-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); if (response.status === 422) { const error = await response.json().catch(() => ({})); showServerErrors(error.details); return; } if (!response.ok) throw new Error(`Request failed (${response.status})`); form.hidden = true; banner.hidden = true; successState.hidden = false; } catch (error) { setBanner('Could not submit the request. Please try again.', 'error'); } finally { setBusy(false); } });
aiReviewBtn.addEventListener('click', async () => { const values = getValues(); const clientErrors = validate(values); if (Object.keys(clientErrors).length) { showErrors(clientErrors); return; } setBusy(true); setBanner('Running AI review…'); try { const response = await fetch('/api/booking-requests/ai-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); if (!response.ok) throw new Error(`AI review failed (${response.status})`); const data = await response.json(); renderReview('AI suggestions and warnings based on the current form state.', data); setBanner('AI review complete.', 'success'); } catch (error) { setBanner('AI review is unavailable right now.', 'error'); } finally { setBusy(false); } });
resetBtn.addEventListener('click', () => { form.reset(); form.hidden = false; successState.hidden = true; aiPanel.hidden = true; clearFieldErrors(); setBanner(''); });
for (const input of fields) { input.addEventListener('blur', () => { const errors = validate(getValues()); if (errors[input.name]) setFieldError(input.name, errors[input.name]); }); }
setBanner('Fill out the form to submit a booking request.');
