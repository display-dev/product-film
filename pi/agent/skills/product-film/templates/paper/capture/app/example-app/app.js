// EXAMPLE APP (Tidewell): a published page view, a share dialog and an invited sign-in with a one-time code.
// Small on purpose, but it has the traps real apps have, so the harness shows how each one is handled:
// relative times (pin the clock), a version poll every 30 s (fast-forward the clock), a one-time notice for a new
// browser (returning-user localStorage), a closed shadow root (forced open by INIT_SCRIPT), CSSOM-only rules, a
// telemetry call to another host (blocked), a code form that submits itself on the last digit, and a status that
// shows for about 120 ms (raw CDP capture).
const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const app = document.getElementById('app');
const api = async (path, opts = {}) => {
  const res = await fetch(`/api${path}`, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } });
  if (!res.ok) {throw Object.assign(new Error(`${res.status}`), { status: res.status });}
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : res.text();
};
const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };

// Theme rules added through the CSSOM: they exist only in the live sheet, never in the <style> text.
const theme = document.getElementById('theme').sheet;
theme.insertRule('.newver b{color:var(--accent);font-weight:600}', 0);
theme.insertRule('.row .role.client{color:var(--accent);font-weight:600}', 1);

// Avatars: a custom element with a CLOSED shadow root.
customElements.define('tw-avatar', class extends HTMLElement {
  connectedCallback() {
    if (this._root) {return;} this._root = this.attachShadow({ mode: 'closed' });
    const n = this.getAttribute('name') || ''; const hue = [...n].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
    this._root.innerHTML = `<style>span{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid #fff;font:600 11px Geist,sans-serif;color:#2a2a2a;background:hsl(${hue} 30% 86%)}</style><span>${esc(n.split(' ').map((w) => w[0]).join(''))}</span>`;
  }
});

// Usage telemetry goes to another host. Captures block it (story.json app.blockHosts).
fetch('https://telemetry.tidewell.example/v1/events', { method: 'POST', mode: 'no-cors', body: JSON.stringify({ event: 'open', path: location.pathname }) }).catch(() => {});

const pageId = (location.pathname.match(/^\/p\/([\w-]+)/) || [])[1] || 'r8Kd2m';
start();
async function start() {
  let session = null;
  try { session = await api('/session'); } catch (e) { if (e.status !== 401) {throw e;} }
  if (session) {pageView(session);} else {signIn();}
}

// ── published page view ───────────────────────────────────────────────────────────
async function pageView(session) {
  const page = await api(`/pages/${pageId}`); let shown = page.version;
  app.innerHTML = '';
  const notice = localStorage.getItem('tidewell:notice-dismissed') === 'comments-1' ? null
    : $('<div class="notice" data-testid="notice"><span>New: comment on any paragraph of a page.</span><button data-testid="notice-dismiss">Dismiss</button></div>');
  const top = $(`<header class="top"><span class="wm">Tidewell</span><nav class="crumb"><span class="org">${esc(page.org)} /</span><b data-testid="page-title">${esc(page.title)}</b><span class="chip" data-testid="version">v${shown}</span></nav>
    <span class="meta" data-testid="updated"></span><span class="spacer"></span>
    <span class="people">${page.people.slice(0, 3).map((p) => `<tw-avatar name="${esc(p.name)}"></tw-avatar>`).join('')}</span>
    ${page.canShare ? '<button class="btn primary" data-testid="share-open">Share</button>' : ''}</header>`);
  const frame = $('<iframe class="doc" data-testid="page-frame" title="Page"></iframe>');
  app.append(top); if (notice) {app.append(notice);} app.append(frame);
  notice?.querySelector('button').addEventListener('click', () => { localStorage.setItem('tidewell:notice-dismissed', 'comments-1'); notice.remove(); fit(); });
  const meta = top.querySelector('[data-testid="updated"]');
  const fit = () => { frame.style.height = `${Math.max(200, innerHeight - frame.getBoundingClientRect().top)}px`; };
  const load = async (v) => { frame.srcdoc = await api(`/pages/${pageId}/content?v=${v}`); shown = v; top.querySelector('[data-testid="version"]').textContent = `v${v}`; };
  const stamp = (p) => { meta.textContent = `Updated ${ago(p.updatedAt)} by ${p.updatedBy}`; };
  stamp(page); await load(shown); fit(); addEventListener('resize', fit);
  top.querySelector('[data-testid="share-open"]')?.addEventListener('click', () => shareDialog(page));
  // A newer version shows as a bar; the page itself never changes under the reader.
  let bar = null;
  const poll = async () => {
    const p = await api(`/pages/${pageId}`).catch(() => null); if (!p) {return;} stamp(p);
    if (p.version > shown && !bar) {
      bar = $(`<div class="newver" data-testid="new-version"><span>A new version is ready: <b>v${p.version}</b></span><button class="btn primary" data-testid="refresh">Refresh</button></div>`);
      top.after(bar); fit();
      bar.querySelector('button').addEventListener('click', async () => { await load(p.version); bar.remove(); bar = null; fit(); });
    }
  };
  setInterval(poll, 30000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') {poll();} });
}

// ── share dialog (owner) ──────────────────────────────────────────────────────────
async function shareDialog(page) {
  const { people } = await api(`/pages/${pageId}/people`);
  const row = (p) => `<div class="row"><tw-avatar name="${esc(p.name)}"></tw-avatar><span class="who"><b>${esc(p.name)}</b><span>${esc(p.email)}</span></span><span class="role${p.role === 'Client' ? ' client' : ''}">${esc(p.role)}</span></div>`;
  const d = $(`<div class="scrim"><div class="dialog" role="dialog" data-testid="share-dialog"><h2>Share “${esc(page.title)}”</h2><p class="sub">Everyone at ${esc(page.org)} can open it.</p>
    <div class="list" data-testid="share-list">${people.map(row).join('')}</div>
    <label class="field">Add people by email<input type="email" data-testid="share-email" placeholder="name@example.com" autocomplete="off"></label>
    <label class="check"><input type="checkbox" data-testid="share-notify"> Send them an email with the link</label>
    <div class="foot"><button class="btn ghost" data-testid="share-cancel">Cancel</button><button class="btn primary" data-testid="share-save" disabled>Save</button></div></div></div>`);
  app.append(d);
  const input = d.querySelector('input[type=email]'), save = d.querySelector('[data-testid="share-save"]'), list = d.querySelector('.list');
  input.addEventListener('input', () => { save.disabled = !input.value.includes('@'); });
  d.querySelector('[data-testid="share-cancel"]').addEventListener('click', () => d.remove());
  save.addEventListener('click', async () => {
    save.disabled = true; input.disabled = true; save.textContent = 'Saving…';
    const r = await api(`/pages/${pageId}/share`, { method: 'POST', body: JSON.stringify({ emails: [input.value], notify: d.querySelector('[data-testid="share-notify"]').checked }) });
    list.innerHTML = r.people.map(row).join(''); list.scrollTop = list.scrollHeight; input.value = ''; save.textContent = 'Saved';
  });
}

// ── invited sign-in with a one-time code (the link in the share email carries #invited=<email>) ──
function signIn() {
  const email = decodeURIComponent((location.hash.match(/invited=([^&]+)/) || [])[1] || '');
  const card = $(`<main class="center"><section class="card" data-testid="signin-card"><span class="wm">Tidewell</span>
    <h1>Sign in to view this page</h1><p>You're invited. We'll send a one-time code to <b data-testid="invited-email">${esc(email)}</b>.</p>
    <button class="btn primary" data-testid="send-code">Send code to ${esc(email)}</button></section></main>`);
  app.innerHTML = ''; app.append(card);
  const send = card.querySelector('[data-testid="send-code"]');
  send.addEventListener('click', async () => {
    send.disabled = true; send.innerHTML = '<span class="spin"></span>Sending…';
    await api('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });
    codeStep(card.querySelector('.card'), email);
  });
}
function codeStep(card, email) {
  card.innerHTML = `<span class="wm">Tidewell</span><h1>Check your email</h1><p>Enter the one-time code we sent to <b>${esc(email)}</b>.</p>
    <div class="otp" data-testid="otp">${[1, 2, 3, 4, 5, 6].map((i) => `${i === 4 ? '<span class="gap"></span>' : ''}<input inputmode="numeric" maxlength="1" data-testid="otp-${i}" aria-label="Digit ${i}">`).join('')}</div>
    <button class="btn primary" data-testid="verify" disabled>Verify</button><p class="err" data-testid="otp-error" hidden></p>`;
  const boxes = [...card.querySelectorAll('.otp input')], verify = card.querySelector('[data-testid="verify"]');
  boxes[0].focus();
  const code = () => boxes.map((b) => b.value).join('');
  const submit = async () => {
    verify.disabled = true; verify.innerHTML = '<span class="spin"></span>Verifying…';
    try { await api('/auth/verify', { method: 'POST', body: JSON.stringify({ email, code: code() }) }); }
    catch { const e = card.querySelector('[data-testid="otp-error"]'); e.hidden = false; e.textContent = 'That code did not match. Try again.'; verify.textContent = 'Verify'; return; }
    card.innerHTML = '<span class="wm">Tidewell</span><div class="done" data-testid="verified"><span class="tick">✓</span><span data-testid="done-text">Verified</span></div>';
    setTimeout(() => {                                   // the status shows for about 120 ms before the page replaces it
      card.querySelector('[data-testid="done-text"]').textContent = 'Opening page…';
      setTimeout(start, 120);
    }, 900);
  };
  boxes.forEach((b, i) => b.addEventListener('input', () => {
    b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) {boxes[i + 1].focus();}
    verify.disabled = code().length < 6; if (code().length === 6) {submit();}   // the last digit submits the form
  }));
}
