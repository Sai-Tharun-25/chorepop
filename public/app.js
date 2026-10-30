const root = document.getElementById('app');
const dialog = document.getElementById('dialog');
const form = document.getElementById('dialog-form');
const fields = document.getElementById('dialog-fields');
const EMOJIS = ['🧹', '🍽️', '🗑️', '🧺', '🧽', '🚿', '🛒', '🐾', '🌿', '🛏️', '✨', '🏡', '♻️', '🍳', '🧼', '🚗'];
const state = {
  code: localStorage.getItem('cp-house-code') || '',
  me: localStorage.getItem('cp-me') || '',
  data: null,
  page: 'board',
  editing: null,
  emoji: '🧹',
  loading: false
};
let toastTimeout;
let refreshPromise;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = date => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const age = (date) => {
  const hours = Math.floor((Date.now() - Number(date)) / 3600000);
  if (hours < 1) return 'Just started';
  if (hours < 24) return `Waiting ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days}d`;
};
const initial = (name) => [...(name || '?')].slice(0, 1).join('').toUpperCase();
const avatar = (member, index, large = false) => `<span class="dot-avatar a${index % 5}" ${large ? 'style="width:46px;height:46px;border-radius:14px;font-size:19px"' : ''}>${escapeHtml(initial(member.name))}</span>`;
function alertToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3700);
}
async function callApi(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'X-Household-Code': state.code, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({ error: 'Unexpected server response.' }));
  if (!response.ok) {
    const err = new Error(data.error || 'Request failed.');
    err.status = response.status;
    throw err;
  }
  return data;
}
async function refresh(quiet = false) {
  if (!state.code) { render(); return; }
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await callApi('/state');
      state.data = data;
      localStorage.setItem('cp-house-code', state.code);
      if (!data.members.some(member => member.id === state.me)) {
        state.me = '';
        localStorage.removeItem('cp-me');
      }
      if (!dialog.open) render();
    } catch (error) {
      if (error.status === 401) {
        state.data = null;
        state.code = '';
        localStorage.removeItem('cp-house-code');
        render();
        alertToast('That household code wasn’t right.');
      } else if (!quiet) {
        if (!state.data) root.innerHTML = `<div class="container join-wrap"><div class="join-art">🛠️</div><h1>Almost there...</h1><p>${escapeHtml(error.message)} Check your Cloudflare configuration or internet connection.</p><button class="button primary" data-act="retry">Try again</button><button class="button secondary" data-act="leave" style="margin-left:8px">Change code</button></div>`;
        alertToast(error.message);
      }
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
function navigation() {
  const tabs = [['board', '▦', 'Board'], ['people', '☺', 'People'], ['activity', '✳', 'Activity'], ['settings', '⚙', 'Settings']];
  return tabs.map(([name, icon, label]) => `<button class="tab ${state.page === name ? 'active' : ''}" data-act="tab" data-page="${name}" aria-current="${state.page === name ? 'page' : 'false'}"><span class="tab-icon">${icon}</span><span>${label}</span></button>`).join('');
}
function render() {
  if (!state.code || !state.data) {
    root.innerHTML = `<div class="container"><header class="header"><div class="brand"><span class="logo-mark">✦</span> ChorePop<span style="color:var(--purple)">.</span></div></header><main class="join-wrap"><div class="join-art">🏡</div><h1>Chores. But make<br/>them fun.</h1><p>One shared home, one simple rotation. Just your people, your chores, and a little less “whose turn is it?”</p><form class="join-box" id="join-form"><div class="field"><label for="house-code">Enter your household code</label><input id="house-code" name="code" type="text" placeholder="Paste the code from your housemate" autocomplete="off" required minlength="20" spellcheck="false" autocapitalize="off" /></div><button type="submit" class="button primary">Enter the house →</button></form><p class="join-foot">The person deploying the app creates this private code. No account or subscription needed.</p></main></div>`;
    return;
  }
  const { members, chores, history } = state.data;
  const me = members.find(m => m.id === state.me);
  const mine = chores.filter(c => c.current_member_id === state.me);
  root.innerHTML = `<div class="container">
    <header class="header">
      <div class="brand"><span class="logo-mark"><span>✦</span></span>ChorePop<span style="color:var(--purple)">.</span></div>
      <nav class="bottom-nav desktop-nav" aria-label="Main menu">${navigation()}</nav>
      <div class="header-actions"><button class="icon-button" data-act="invite" aria-label="Share with household" title="Share invite">↗</button><button class="round-pill" data-act="select-person">${me ? `${escapeHtml(initial(me.name))} · ${escapeHtml(me.name)}` : '👤 Who am I?'}</button></div>
    </header>
    <main>${state.page === 'board' ? board(members, chores, mine, me) : state.page === 'people' ? people(members, chores, history) : state.page === 'activity' ? activity(history) : settings(me)}</main>
    <nav class="bottom-nav mobile-nav" aria-label="Main menu">${navigation()}</nav>
    </div>`;
}
function board(members, chores, mine, me) {
  return `<section class="hero"><div class="hero-content"><div class="eyebrow">✨ NO DRAMA, JUST DONE</div><h1>Keep the good vibes rolling.</h1><p>Same order, every time. Finish your chore, tap done, and we'll pass the baton.</p><div class="hero-stats"><div class="stat"><strong>${mine.length}</strong> your turn</div><div class="stat"><strong>${chores.length}</strong> active chores</div><div class="stat"><strong>${members.length}</strong> housemates</div></div></div></section>
    <section class="member-panel"><span class="panel-label">🙋 I'm viewing as</span><div class="member-pills">${members.map((m, i) => `<button class="member-chip ${m.id === state.me ? 'selected' : ''}" data-act="pick-person" data-id="${m.id}">${avatar(m, i)} ${escapeHtml(m.name)}</button>`).join('')}<button class="member-chip" data-act="add-member">＋ Add</button></div></section>
    ${!me && members.length ? `<div class="tip"><span>👋</span><div><strong>Pick your name to get started</strong><p>Choose who you are above to see your turns, mark chores done, and switch on notifications.</p></div></div>` : ''}
    ${me ? notificationTip() : ''}
    <section class="board"><div class="toolbar"><div><h2 class="section-title">${me ? `${escapeHtml(me.name)}'s turn ${mine.length ? '🔥' : '🎉'}` : 'Your household board 🎯'}</h2><p class="subtext">${me ? mine.length ? 'These chores are waiting for you.' : 'All caught up. Enjoy your break!' : 'See whose turn it is below.'}</p></div><div class="actions"><button class="button secondary" data-act="add-member">＋ Member</button><button class="button primary" data-act="add-chore">＋ New chore</button></div></div>
    ${members.length === 0 ? `<div class="empty"><span class="empty-icon">🏠</span><h3>First, meet the crew!</h3><p>Add yourself and your housemates, then create your first chore.</p><button class="button primary" data-act="add-member">Add your first person +</button></div>` : chores.length === 0 ? `<div class="empty"><span class="empty-icon">🧽</span><h3>A clean slate!</h3><p>Create your first chore. The person you choose gets the first turn.</p><button class="button primary" data-act="add-chore">Create a chore +</button></div>` : me ? `${mine.length ? `<div class="cards">${mine.map((c, i) => choreCard(c, i, members)).join('')}</div>` : ''}<div class="section-divider"><h2>Everyone else's chores</h2></div>${chores.length - mine.length ? `<div class="cards">${chores.filter(c => c.current_member_id !== state.me).map((c, i) => choreCard(c, i + mine.length, members)).join('')}</div>` : `<div class="empty"><span class="empty-icon">✨</span><h3>Nothing else waiting</h3><p>You're seeing all the active chores for now.</p></div>`}` : `<div class="cards">${chores.map((c, i) => choreCard(c, i, members)).join('')}</div>`}
    </section>`;
}
function choreCard(chore, index, members) {
  const mine = chore.current_member_id === state.me;
  const memberIndex = Math.max(0, members.findIndex(m => m.id === chore.current_member_id));
  const member = members[memberIndex] || { name: chore.current_member_name || 'Housemate' };
  return `<article class="chore-card ${mine ? 'is-mine' : ''}">
    <div class="card-top"><span class="emoji-tile c${index % 6}">${escapeHtml(chore.emoji)}</span><button class="card-menu" data-act="edit-chore" data-id="${chore.id}" aria-label="Edit ${escapeHtml(chore.title)}">···</button></div>
    <h3>${escapeHtml(chore.title)}</h3>
    ${mine ? `<span class="card-tag" style="align-self:flex-start;margin-top:6px">⭐ You're up!</span>` : ''}
    <div class="card-bottom"><div class="assignment">${avatar(member, memberIndex)}<div><strong>${escapeHtml(member.name)}</strong><small>${age(chore.turn_started_at)} · ${chore.completed_count} done</small></div></div>${mine ? `<button class="button done mini" data-act="complete" data-id="${chore.id}">✓ Done!</button>` : state.me ? (state.data.credits?.some(x => x.chore_id === chore.id && x.member_id === state.me) ? `<span class="card-tag">🎟️ Skip earned</span>` : `<button class="button secondary mini" data-act="early" data-id="${chore.id}">⚡ I did it early</button>`) : `<span class="card-tag">On deck</span>`}</div>
    </article>`;
}
function notificationTip() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return `<div class="tip"><span>🔔</span><div><strong>Push isn't available in this browser</strong><p>You can still use the full board. On iPhone, install it to your Home Screen for notifications.</p></div></div>`;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isIOS && !standalone) return `<div class="tip"><span>📲</span><div><strong>Make it feel like an iPhone app</strong><p>In Safari, tap Share → Add to Home Screen → Add. Open ChorePop from your Home Screen, then tap Enable reminders.</p></div></div>`;
  if (Notification.permission === 'denied') return `<div class="tip"><span>🔕</span><div><strong>Notifications are blocked</strong><p>Allow ChorePop notifications in your device/browser settings to get turn alerts.</p></div></div>`;
  return `<div class="tip"><span>🔔</span><div style="flex:1"><strong>Reminders for your turn</strong><p>Get notified when it's your turn, then around every 24 hours until you're done. Set this up once on each device.</p><button class="text-button" data-act="enable-push">${Notification.permission === 'granted' ? 'Set up / refresh notifications →' : 'Enable reminders →'}</button></div></div>`;
}
function people(members, chores, history) {
  return `<section class="board"><div class="toolbar"><div><div class="eyebrow" style="color:var(--purple)">THE CREW</div><h1 class="section-title" style="font-size:31px;margin-top:7px">Your housemates 🫶</h1><p class="subtext">Rotation is always in this order. New people join at the end.</p></div><button class="button primary" data-act="add-member">＋ Add member</button></div>
  ${members.length ? `<div class="people-grid">${members.map((m, i) => `<article class="person-card">${avatar(m, i, true)}<div class="person-info"><strong>${i + 1}. ${escapeHtml(m.name)} ${m.id === state.me ? '· you' : ''}</strong><small>${chores.filter(c => c.current_member_id === m.id).length} current · ${history.filter(h => h.member_id === m.id).length} recent completions</small></div><button class="text-button" data-act="edit-member" data-id="${m.id}">Edit</button></article>`).join('')}</div>` : `<div class="empty"><span class="empty-icon">👋</span><h3>Invite the crew</h3><p>Add your first member to get the rotation started.</p></div>`}
  <p class="note">💡 Removing someone passes their current chores to the next person. All remaining members keep their relative order.</p></section>`;
}
function activity(history) {
  return `<section class="board"><div class="toolbar"><div><div class="eyebrow" style="color:var(--purple)">HIGH FIVES ALL AROUND</div><h1 class="section-title" style="font-size:31px;margin-top:7px">Done & dusted ✨</h1><p class="subtext">Your latest 40 completions, including early help.</p></div></div>
  ${history.length ? `<div class="activity">${history.map(h => `<article class="activity-item"><span class="activity-symbol">✓</span><div><p><strong>${escapeHtml(h.member_name)}</strong> ${h.event_type === 'early' ? 'did an early completion of' : 'finished'} <strong>${escapeHtml(h.chore_title)}</strong>${h.event_type === 'early' ? ' ⚡ (skip credit)' : ''}</p><small>${fmt(h.done_at)}</small></div></article>`).join('')}</div>` : `<div class="empty"><span class="empty-icon">🥳</span><h3>Great things start here</h3><p>Finished chores will show up here once you tap Done.</p></div>`}</section>`;
}
function settings(me) {
  const supported = 'PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator;
  return `<section class="board"><div class="toolbar"><div><div class="eyebrow" style="color:var(--purple)">HOUSE RULES</div><h1 class="section-title" style="font-size:31px;margin-top:7px">Settings ⚙️</h1><p class="subtext">All chores and history are stored in Cloudflare, not on anyone's phone.</p></div></div>
  <div class="person-card" style="display:block;padding:10px 22px">
  <div class="settings-row"><div><strong>🔗 Invite your housemates</strong><p>Share a private link with your household code included.</p></div><button class="button secondary mini" data-act="invite">Share link</button></div>
  <div class="settings-row"><div><strong>🙋 Your identity on this device</strong><p>${me ? `Notifications will be assigned to ${escapeHtml(me.name)}.` : 'Select your name to receive the right reminders.'}</p></div><button class="button secondary mini" data-act="select-person">${me ? 'Change' : 'Choose'}</button></div>
  <div class="settings-row"><div><strong>🔔 Push reminders</strong><p>${supported ? 'Instant turn alerts plus daily nudges. Enable separately on every phone.' : 'Not supported by this browser.'}</p></div><div class="actions"><button class="button primary mini" data-act="enable-push" ${!supported ? 'disabled' : ''}>Enable</button><button class="button secondary mini" data-act="disable-push" ${!supported ? 'disabled' : ''}>Disable</button></div></div>
  <div class="settings-row"><div><strong>🚪 Leave this household on this device</strong><p>Forget your code and chosen name here. Shared chores aren't deleted.</p></div><button class="button secondary mini" data-act="leave">Leave</button></div></div>
  <p class="note">Anyone with the household link can view or edit the board and choose a member name. Keep the link private. No sign-up or separate administrator login is required.</p></section>`;
}
function openDialog(mode, id) {
  state.editing = { mode, id };
  state.emoji = '🧹';
  const data = state.data;
  const member = data.members.find(m => m.id === id);
  const chore = data.chores.find(c => c.id === id);
  let title = '';
  if (mode === 'add-member' || mode === 'edit-member') {
    title = mode === 'add-member' ? 'Add a housemate' : 'Edit housemate';
    fields.innerHTML = `<div class="field"><label for="input-name">Name</label><input id="input-name" name="name" type="text" maxlength="32" placeholder="e.g. Alex" value="${mode === 'edit-member' ? escapeHtml(member.name) : ''}" required autocomplete="off" /></div>${mode === 'edit-member' ? `<button type="button" class="text-button danger" data-act="delete-member" data-id="${id}">Remove this housemate</button>` : '<p class="subtext">New members go to the end of the rotation.</p>'}`;
  } else {
    title = mode === 'add-chore' ? 'Add a new chore' : 'Edit a chore';
    state.emoji = chore?.emoji || '🧹';
    fields.innerHTML = `<div class="field"><label for="input-title">What's the chore?</label><input id="input-title" name="title" type="text" maxlength="70" placeholder="e.g. Take out the trash" value="${mode === 'edit-chore' ? escapeHtml(chore.title) : ''}" required autocomplete="off" /></div>
    <div class="field"><label>Pick an icon</label><div class="emoji-picker">${EMOJIS.map(e => `<button type="button" class="emoji-option ${state.emoji === e ? 'selected' : ''}" data-act="choose-emoji" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}</div></div>
    ${mode === 'add-chore' ? `<div class="field"><label for="input-member">Who starts the rotation?</label><select id="input-member" name="memberId" required>${data.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select><small class="help">Every completed turn moves to the next member in the People list.</small></div>` : `<p class="subtext">Editing keeps the current assignment and rotation unchanged.</p><button type="button" class="text-button danger" data-act="delete-chore" data-id="${id}">Delete this chore</button>`}`;
  }
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('save-dialog').textContent = mode.startsWith('add') ? 'Add it! ✨' : 'Save changes';
  dialog.showModal();
  setTimeout(() => fields.querySelector('input')?.focus(), 30);
}
async function saveDialog(event) {
  event.preventDefault();
  const { mode, id } = state.editing;
  const inputs = new FormData(form);
  const save = document.getElementById('save-dialog');
  save.disabled = true;
  try {
    if (mode === 'add-member') await callApi('/members', { method: 'POST', body: JSON.stringify({ name: inputs.get('name') }) });
    if (mode === 'edit-member') await callApi(`/members/${id}`, { method: 'PATCH', body: JSON.stringify({ name: inputs.get('name') }) });
    if (mode === 'add-chore') await callApi('/chores', { method: 'POST', body: JSON.stringify({ title: inputs.get('title'), memberId: inputs.get('memberId'), emoji: state.emoji }) });
    if (mode === 'edit-chore') await callApi(`/chores/${id}`, { method: 'PATCH', body: JSON.stringify({ title: inputs.get('title'), emoji: state.emoji }) });
    dialog.close();
    alertToast(mode.startsWith('add') ? 'Added! Let the good times roll ✨' : 'Saved!');
    await refresh();
  } catch (err) { alertToast(err.message); }
  finally { save.disabled = false; }
}
async function enablePush() {
  if (!state.me) { alertToast('Pick your name first!'); state.page = 'board'; render(); return; }
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) { alertToast('Push notifications are unavailable in this browser.'); return; }
  if (!state.data?.vapidPublicKey) { alertToast('Push is not configured on the server yet.'); return; }
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)) { alertToast('On iPhone, first use Safari → Share → Add to Home Screen, then open the app.'); return; }
  try {
    // Start the permission request directly within this tap, as iOS requires a user gesture.
    const permissionPromise = Notification.permission === 'default' ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    const permission = await permissionPromise;
    if (permission !== 'granted') { alertToast('Notifications were not allowed.'); return; }
    const sw = await navigator.serviceWorker.ready;
    let subscription = await sw.pushManager.getSubscription();
    if (!subscription) {
      subscription = await sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapid(state.data.vapidPublicKey) });
    }
    await callApi('/push/subscribe', { method: 'POST', body: JSON.stringify({ memberId: state.me, subscription: subscription.toJSON() }) });
    alertToast('Reminders are on! 🔔');
  } catch (err) { alertToast(`Couldn't enable reminders: ${err.message}`); }
}
function decodeVapid(key) {
  const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function reassignPush() {
  if (!state.me || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (sub) await callApi('/push/subscribe', { method: 'POST', body: JSON.stringify({ memberId: state.me, subscription: sub.toJSON() }) });
  } catch (err) { console.warn('Could not update notification identity:', err); }
}
async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (sub) {
      await callApi('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    alertToast('Reminders disabled on this device.');
  } catch (err) { alertToast(err.message); }
}
function chooseMember(id) {
  const m = state.data?.members.find(x => x.id === id);
  if (!m) return;
  state.me = id;
  localStorage.setItem('cp-me', id);
  render();
  reassignPush();
  alertToast(`Hi ${m.name}! 👋`);
}
async function invite() {
  const link = `${location.origin}/?join=${encodeURIComponent(state.code)}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Join our ChorePop household!', text: 'Keep our chores rotating without the drama. 🏠', url: link });
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(link); alertToast('Private invite link copied! 🔗'); }
    else window.prompt('Copy this private invite link:', link);
  } catch (err) { if (err.name !== 'AbortError') alertToast('Could not share the invite link.'); }
}
async function actions(event) {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const { act, id } = target.dataset;
  if (act === 'tab') { state.page = target.dataset.page; render(); window.scrollTo(0, 0); }
  else if (act === 'add-member') openDialog('add-member');
  else if (act === 'add-chore') {
    if (!state.data.members.length) { alertToast('Add a person first!'); openDialog('add-member'); }
    else openDialog('add-chore');
  }
  else if (act === 'edit-member') openDialog('edit-member', id);
  else if (act === 'edit-chore') openDialog('edit-chore', id);
  else if (act === 'choose-emoji') { state.emoji = target.dataset.emoji; fields.querySelectorAll('.emoji-option').forEach(node => node.classList.toggle('selected', node === target)); }
  else if (act === 'pick-person') chooseMember(id);
  else if (act === 'select-person') { state.page = 'board'; render(); document.querySelector('.member-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); alertToast('Choose your name from the member chips.'); }
  else if (act === 'invite') invite();
  else if (act === 'enable-push') enablePush();
  else if (act === 'disable-push') disablePush();
  else if (act === 'early') {
    if (!state.me) return alertToast('Select your name first.');
    if (!confirm('Did you do this chore early? You will earn one skip for this chore, and the current assigned person will stay the same.')) return;
    target.disabled = true;
    try {
      await callApi(`/chores/${id}/early`, { method: 'POST', body: JSON.stringify({ memberId: state.me }) });
      alertToast('Great work! One skip earned ⚡');
      await refresh();
    } catch (err) { alertToast(err.message); await refresh(); }
    finally { target.disabled = false; }
  }
  else if (act === 'complete') {
    target.disabled = true;
    try {
      await callApi(`/chores/${id}/complete`, { method: 'POST', body: JSON.stringify({ memberId: state.me }) });
      alertToast('Nice work! The baton has been passed 🎉');
      await refresh();
    } catch (err) { alertToast(err.message); await refresh(); }
    finally { target.disabled = false; }
  }
  else if (act === 'delete-member') {
    if (!confirm('Remove this person? Their current chores will be passed to the next housemate.')) return;
    try { await callApi(`/members/${id}`, { method: 'DELETE' }); dialog.close(); await refresh(); alertToast('Person removed from rotation.'); }
    catch (err) { alertToast(err.message); }
  }
  else if (act === 'delete-chore') {
    if (!confirm('Delete this chore? It will no longer rotate.')) return;
    try { await callApi(`/chores/${id}`, { method: 'DELETE' }); dialog.close(); await refresh(); alertToast('Chore deleted.'); }
    catch (err) { alertToast(err.message); }
  }
  else if (act === 'leave') {
    if (!confirm('Forget this household on this device? The shared data will remain safe.')) return;
    // Unregister this phone so leaving doesn't keep delivering alerts.
    try { await disablePush(); } catch {}
    localStorage.removeItem('cp-house-code');
    localStorage.removeItem('cp-me');
    state.code = ''; state.me = ''; state.data = null;
    render();
  }
  else if (act === 'retry') refresh();
}
document.addEventListener('click', actions);
form.addEventListener('submit', saveDialog);
document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
document.getElementById('cancel-dialog').addEventListener('click', () => dialog.close());
document.addEventListener('submit', async event => {
  if (event.target.id !== 'join-form') return;
  event.preventDefault();
  state.code = event.target.elements.code.value.trim();
  await refresh();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker not registered:', err));
const inviteCode = new URL(location.href).searchParams.get('join');
if (inviteCode) {
  state.code = inviteCode.trim();
  history.replaceState(null, '', '/');
}
if (state.code) refresh(); else render();
setInterval(() => { if (state.code && state.data && !document.hidden) refresh(true); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.code) refresh(true); });
