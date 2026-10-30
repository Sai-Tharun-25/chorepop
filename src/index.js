import { buildPushPayload } from '@block65/webcrypto-web-push';

const DAY_MS = 24 * 60 * 60 * 1000;
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const SAFE_EMOJI = ['🧹', '🍽️', '🗑️', '🧺', '🧽', '🚿', '🛒', '🐾', '🌿', '🛏️', '✨', '🏡', '♻️', '🍳', '🧼', '🚗'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function fail(message, status = 400) { return json({ error: message }, status); }
function isString(value, max = 80) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
async function payload(request) {
  const raw = await request.text();
  if (raw.length > 10000) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
function requireCode(request, env) {
  const value = request.headers.get('X-Household-Code') || '';
  return !!env.HOUSEHOLD_CODE && value.length >= 20 && value === env.HOUSEHOLD_CODE;
}
async function getMembers(db) {
  const r = await db.prepare('SELECT id, name, sort_order, created_at FROM members ORDER BY sort_order ASC').all();
  return r.results || [];
}
async function getChores(db) {
  const r = await db.prepare(`SELECT c.id, c.title, c.emoji, c.current_member_id, c.turn_started_at,
    c.completed_count, c.created_at, m.name AS current_member_name
    FROM chores c JOIN members m ON m.id = c.current_member_id ORDER BY c.created_at ASC`).all();
  return r.results || [];
}
async function nextMember(db, memberId) {
  const current = await db.prepare('SELECT sort_order FROM members WHERE id = ?').bind(memberId).first();
  if (!current) return null;
  return (await db.prepare('SELECT id, name FROM members WHERE sort_order > ? ORDER BY sort_order LIMIT 1')
    .bind(current.sort_order).first()) ||
    (await db.prepare('SELECT id, name FROM members ORDER BY sort_order LIMIT 1').first());
}
async function nextUncreditedMember(db, choreId, currentId) {
  const members = await getMembers(db);
  if (!members.length) return null;
  const index = members.findIndex(m => m.id === currentId);
  if (index < 0) return null;
  const credits = (await db.prepare('SELECT member_id FROM skip_credits WHERE chore_id = ?').bind(choreId).all()).results || [];
  const credited = new Set(credits.map(r => r.member_id));
  const consumed = [];
  for (let offset = 1; offset <= members.length; offset++) {
    const person = members[(index + offset) % members.length];
    if (!credited.has(person.id)) return { next: person, consumed };
    consumed.push(person.id);
  }
  // Everyone was credited: consume the whole round and return to normal order.
  return { next: members[(index + 1) % members.length], consumed };
}
async function memberExists(db, id) {
  return !!(await db.prepare('SELECT id FROM members WHERE id = ?').bind(id).first());
}
function validPushUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false;
    const h = parsed.hostname.toLowerCase();
    return !(/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/.test(h)) && h.includes('.');
  } catch { return false; }
}
async function sendForMember(env, memberId, msg) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  const subs = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE member_id = ? LIMIT 8')
    .bind(memberId).all()).results || [];
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
  for (const s of subs) {
    try {
      const subscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
      const message = { data: JSON.stringify(msg), options: { ttl: 86400 } };
      const pushPayload = await buildPushPayload(message, subscription, vapid);
      const response = await fetch(s.endpoint, pushPayload);
      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run();
      } else if (!response.ok) {
        console.log('Push delivery rejected:', response.status);
      }
    } catch (err) { console.log('Push send failed:', String(err)); }
  }
}
function notifyTurn(env, ctx, chore, memberId, name) {
  ctx.waitUntil(sendForMember(env, memberId, {
    title: 'It’s your turn! 🎉',
    body: `${name}, you’re up for ${chore.emoji} ${chore.title}.`,
    tag: `chore-${chore.id}`
  }));
}

async function api(request, env, ctx) {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') return json({ ok: true, name: 'ChorePop' });
  if (!env.DB || !env.HOUSEHOLD_CODE) return fail('Server setup incomplete. See README for database and household code.', 503);
  if (!requireCode(request, env)) return fail('Incorrect household code.', 401);
  const method = request.method;
  const db = env.DB;

  if (pathname === '/api/state' && method === 'GET') {
    const [members, chores, history] = await Promise.all([
      getMembers(db), getChores(db),
      db.prepare(`SELECT id, chore_title, member_id, member_name, done_at, 'turn' AS event_type FROM history
        UNION ALL SELECT id, chore_title, member_id, member_name, done_at, 'early' AS event_type FROM early_completions
        ORDER BY done_at DESC LIMIT 40`).all()
    ]);
    const credits = (await db.prepare('SELECT chore_id, member_id FROM skip_credits').all()).results || [];
    return json({ members, chores, history: history.results || [], credits, vapidPublicKey: env.VAPID_PUBLIC_KEY || null, now: Date.now() });
  }
  if (pathname === '/api/members' && method === 'POST') {
    const body = await payload(request);
    if (!isString(body.name, 32)) return fail('Enter a name between 1 and 32 characters.');
    const name = body.name.trim();
    const row = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM members').first();
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO members (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, name, row.next_order, Date.now()).run();
    return json({ id, name }, 201);
  }
  const memberMatch = pathname.match(/^\/api\/members\/([a-z0-9-]+)$/i);
  if (memberMatch && method === 'PATCH') {
    const body = await payload(request);
    if (!isString(body.name, 32)) return fail('Enter a name between 1 and 32 characters.');
    const res = await db.prepare('UPDATE members SET name = ? WHERE id = ?')
      .bind(body.name.trim(), memberMatch[1]).run();
    return res.meta.changes ? json({ ok: true }) : fail('Member not found.', 404);
  }
  if (memberMatch && method === 'DELETE') {
    const memberId = memberMatch[1];
    const members = await getMembers(db);
    const removed = members.find(m => m.id === memberId);
    if (!removed) return fail('Member not found.', 404);
    const allChores = await getChores(db);
    if (members.length === 1 && allChores.length) return fail('Delete all chores before removing the last person.');
    const replacement = members.find(m => m.sort_order > removed.sort_order && m.id !== memberId) || members.find(m => m.id !== memberId);
    const now = Date.now();
    if (replacement) {
      await db.prepare(`UPDATE chores SET current_member_id = ?, turn_started_at = ?, last_reminder_at = NULL
        WHERE current_member_id = ?`).bind(replacement.id, now, memberId).run();
    }
    await db.prepare('DELETE FROM skip_credits WHERE member_id = ?').bind(memberId).run();
    await db.prepare('DELETE FROM members WHERE id = ?').bind(memberId).run();
    for (const chore of allChores.filter(c => c.current_member_id === memberId)) notifyTurn(env, ctx, chore, replacement.id, replacement.name);
    return json({ ok: true });
  }
  if (pathname === '/api/chores' && method === 'POST') {
    const body = await payload(request);
    if (!isString(body.title, 70)) return fail('Enter a chore title between 1 and 70 characters.');
    if (!isString(body.memberId, 80) || !(await memberExists(db, body.memberId))) return fail('Choose an existing member to start.');
    const emoji = SAFE_EMOJI.includes(body.emoji) ? body.emoji : '🧹';
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.prepare(`INSERT INTO chores (id, title, emoji, current_member_id, turn_started_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(id, body.title.trim(), emoji, body.memberId, now, now).run();
    const assignee = await db.prepare('SELECT name FROM members WHERE id = ?').bind(body.memberId).first();
    notifyTurn(env, ctx, { id, title: body.title.trim(), emoji }, body.memberId, assignee.name);
    return json({ id }, 201);
  }
  const choreMatch = pathname.match(/^\/api\/chores\/([a-z0-9-]+)$/i);
  if (choreMatch && method === 'PATCH') {
    const body = await payload(request);
    if (!isString(body.title, 70)) return fail('Enter a chore title between 1 and 70 characters.');
    const emoji = SAFE_EMOJI.includes(body.emoji) ? body.emoji : '🧹';
    const changed = await db.prepare('UPDATE chores SET title = ?, emoji = ? WHERE id = ?')
      .bind(body.title.trim(), emoji, choreMatch[1]).run();
    return changed.meta.changes ? json({ ok: true }) : fail('Chore not found.', 404);
  }
  if (choreMatch && method === 'DELETE') {
    const changed = await db.prepare('DELETE FROM chores WHERE id = ?').bind(choreMatch[1]).run();
    return changed.meta.changes ? json({ ok: true }) : fail('Chore not found.', 404);
  }
  const earlyMatch = pathname.match(/^\/api\/chores\/([a-z0-9-]+)\/early$/i);
  if (earlyMatch && method === 'POST') {
    const body = await payload(request);
    const chore = await db.prepare('SELECT * FROM chores WHERE id = ?').bind(earlyMatch[1]).first();
    if (!chore) return fail('Chore not found.', 404);
    if (!isString(body.memberId, 80) || !(await memberExists(db, body.memberId))) return fail('Choose your name first.');
    if (body.memberId === chore.current_member_id) return fail('It is your turn. Use Done instead.', 409);
    const inserted = await db.prepare(`INSERT OR IGNORE INTO skip_credits (chore_id, member_id, earned_at) VALUES (?, ?, ?)`)
      .bind(chore.id, body.memberId, Date.now()).run();
    if (!inserted.meta.changes) return fail('You already have a skip credit for this chore.', 409);
    const member = await db.prepare('SELECT name FROM members WHERE id = ?').bind(body.memberId).first();
    await db.prepare(`INSERT INTO early_completions (id, chore_id, chore_title, member_id, member_name, done_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), chore.id, chore.title, body.memberId, member.name, Date.now()).run();
    return json({ ok: true, message: 'One skip credit earned. The current turn did not change.' });
  }
  const completeMatch = pathname.match(/^\/api\/chores\/([a-z0-9-]+)\/complete$/i);
  if (completeMatch && method === 'POST') {
    const body = await payload(request);
    const chore = await db.prepare('SELECT * FROM chores WHERE id = ?').bind(completeMatch[1]).first();
    if (!chore) return fail('Chore not found.', 404);
    if (body.memberId !== chore.current_member_id) return fail('It is someone else’s turn! Refresh your board.', 409);
    const rotation = await nextUncreditedMember(db, chore.id, chore.current_member_id);
    const next = rotation?.next;
    if (!next) return fail('Add a household member first.');
    const member = await db.prepare('SELECT name FROM members WHERE id = ?').bind(chore.current_member_id).first();
    const now = Date.now();
    const updated = await db.prepare(`UPDATE chores SET current_member_id = ?, turn_started_at = ?,
      last_reminder_at = NULL, completed_count = completed_count + 1
      WHERE id = ? AND current_member_id = ? AND turn_started_at = ? AND completed_count = ? RETURNING id`)
      .bind(next.id, now, chore.id, chore.current_member_id, chore.turn_started_at, chore.completed_count).first();
    if (!updated) return fail('This turn was already completed. Refresh your board.', 409);
    for (const memberId of rotation.consumed) {
      await db.prepare('DELETE FROM skip_credits WHERE chore_id = ? AND member_id = ?').bind(chore.id, memberId).run();
    }
    await db.prepare(`INSERT INTO history (id, chore_id, chore_title, member_id, member_name, done_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), chore.id, chore.title, chore.current_member_id, member?.name || 'Former member', now).run();
    notifyTurn(env, ctx, chore, next.id, next.name);
    return json({ ok: true, nextMemberName: next.name });
  }
  if (pathname === '/api/push/subscribe' && method === 'POST') {
    const body = await payload(request);
    if (!(await memberExists(db, body.memberId))) return fail('Select your name first.');
    const s = body.subscription;
    if (!s || !isString(s.endpoint, 2000) || !validPushUrl(s.endpoint) ||
      !isString(s.keys?.p256dh, 200) || !isString(s.keys?.auth, 100)) return fail('Invalid push subscription.');
    await db.prepare(`INSERT INTO push_subscriptions (id, member_id, endpoint, p256dh, auth, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET
      member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), body.memberId, s.endpoint, s.keys.p256dh, s.keys.auth, Date.now()).run();
    const active = (await db.prepare('SELECT id, title, emoji FROM chores WHERE current_member_id = ? LIMIT 5')
      .bind(body.memberId).all()).results || [];
    if (active.length) {
      ctx.waitUntil(sendForMember(env, body.memberId, {
        title: 'You’re all set! 🔔',
        body: `You have ${active.length} chore${active.length === 1 ? '' : 's'} waiting for you.`,
        tag: 'chorepop-welcome'
      }));
    }
    return json({ ok: true });
  }
  if (pathname === '/api/push/unsubscribe' && method === 'POST') {
    const body = await payload(request);
    if (!isString(body.endpoint, 2000)) return fail('Missing subscription.');
    await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();
    return json({ ok: true });
  }
  return fail('Not found.', 404);
}

export default {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return fail('Not available.', 405);
    try { return await api(request, env, ctx); }
    catch (err) {
      console.error('API error:', String(err));
      if (err.status) return fail(err.message, err.status);
      if (String(err).includes('UNIQUE constraint failed')) return fail('That name already exists. Try another.', 409);
      return fail('Something went wrong. Try again.', 500);
    }
  },
  async scheduled(_controller, env, ctx) {
    if (!env.DB || !env.VAPID_PRIVATE_KEY) return;
    const now = Date.now();
    const due = (await env.DB.prepare(`SELECT id, title, emoji, current_member_id, turn_started_at FROM chores
      WHERE turn_started_at <= ? AND (last_reminder_at IS NULL OR last_reminder_at <= ?)
      ORDER BY COALESCE(last_reminder_at, turn_started_at) ASC LIMIT 6`)
      .bind(now - DAY_MS, now - DAY_MS).all()).results || [];
    for (const chore of due) {
      const changed = await env.DB.prepare(`UPDATE chores SET last_reminder_at = ?
        WHERE id = ? AND current_member_id = ? AND turn_started_at = ?
        AND (last_reminder_at IS NULL OR last_reminder_at <= ?) RETURNING id`)
        .bind(now, chore.id, chore.current_member_id, chore.turn_started_at, now - DAY_MS).first();
      if (changed) {
        ctx.waitUntil(sendForMember(env, chore.current_member_id, {
          title: 'Friendly chore nudge 👀',
          body: `Still your turn for ${chore.emoji} ${chore.title}. Tap when it’s done!`,
          tag: `chore-${chore.id}`
        }));
      }
    }
  }
};
