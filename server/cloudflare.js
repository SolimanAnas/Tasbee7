function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDec(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// ====== Web Push Encryption (RFC 8291) ======

async function encryptPayload(text, subP256dh, subAuth) {
  // 1. Ephemeral ECDH key pair
  const serverKey = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPub = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKey.publicKey));

  // 2. Import subscription public key (prepend 0x04 if missing)
  const subRaw = subP256dh[0] === 0x04 ? subP256dh
    : new Uint8Array([0x04, ...subP256dh]);
  const subKey = await crypto.subtle.importKey(
    'raw', subRaw, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

  // 3. ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subKey }, serverKey.privateKey, 256));

  // 4. Salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derive keys via HKDF — RFC 8291 §3.3/§3.4 two-stage derivation:
  //    IKM   = HKDF(salt=auth_secret, ikm=ecdh_secret,
  //                 info="WebPush: info"||0x00||ua_pub(65)||as_pub(65), 32)
  //    CEK   = HKDF(salt=salt, ikm=IKM, info="Content-Encoding: aes128gcm"||0x00, 16)
  //    NONCE = HKDF(salt=salt, ikm=IKM, info="Content-Encoding: nonce"||0x00, 12)
  //    (Browsers derive exactly this; any other scheme fails decryption silently.)
  const enc8291 = new TextEncoder();
  const ecdhKey = await crypto.subtle.importKey(
    'raw', sharedSecret, 'HKDF', false, ['deriveBits']);

  const keyInfo = new Uint8Array([
    ...enc8291.encode('WebPush: info\0'), ...subRaw, ...serverPub]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: subAuth, info: keyInfo },
    ecdhKey, 256));

  const ikmKey = await crypto.subtle.importKey(
    'raw', ikm, 'HKDF', false, ['deriveBits']);

  const cek = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt,
      info: enc8291.encode('Content-Encoding: aes128gcm\0') },
    ikmKey, 128);

  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt,
      info: enc8291.encode('Content-Encoding: nonce\0') },
    ikmKey, 96);

  // 6. Pad payload (RFC 8188 §2): plaintext || delimiter octet.
  //    0x02 marks the last (here: only) record. The old 2-byte length prefix
  //    belongs to the legacy "aesgcm" scheme — using it under aes128gcm makes
  //    browsers fail decryption and silently drop the push.
  const payloadBytes = new TextEncoder().encode(text);
  const record = new Uint8Array(payloadBytes.length + 1);
  record.set(payloadBytes, 0);
  record[payloadBytes.length] = 0x02;

  // 7. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey(
    'raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce), tagLength: 128 },
    aesKey, record));

  // 8. Build output (RFC 8188 §2.1 header + body):
  //    salt(16) || rs(4) || idlen(1) || keyid(=server public key, 65) || ciphertext
  //    rs must be >= the record size; 4096 is the conventional value and our
  //    payloads are far smaller, so the single record is correctly "final".
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);

  const out = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  out.set(salt, 0);
  out.set(rs, 16);
  out[20] = 65; // idlen: length of the keyid field (uncompressed P-256 point)
  out.set(serverPub, 21);
  out.set(ciphertext, 86);
  return out;
}

// ====== VAPID JWT Signing (ES256 via JWK) ======

async function signVapid(privateKey32, publicKey65, audience) {
  // JWK from raw P-256 key
  const x = publicKey65.slice(1, 33);
  const y = publicKey65.slice(33, 65);
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    d: b64url(privateKey32),
    x: b64url(x),
    y: b64url(y),
    key_ops: ['sign']
  };
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  const enc = new TextEncoder();
  const headerB64  = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payloadB64 = b64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:admin@zad-al-muslim.com'
  })));
  const toSign = enc.encode(`${headerB64}.${payloadB64}`);

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, toSign);

  // Return the full JWT: base64url(header).base64url(payload).base64url(signature)
  return `${headerB64}.${payloadB64}.${b64url(new Uint8Array(sig))}`;
}

// ====== Send one encrypted Web Push to a single subscription ======
// Returns the HTTP status from the push service (2xx = delivered, 410/404 = gone).
async function sendPushToSubscriber(env, subscription, payloadObj) {
  const privKey = b64urlDec(env.VAPID_PRIVATE_KEY);
  const pubKey  = b64urlDec(env.VAPID_PUBLIC_KEY);

  const aud = new URL(subscription.endpoint).origin;     // VAPID aud = endpoint origin (per browser)
  const vapidToken = await signVapid(privKey, pubKey, aud);
  const vapidKeyB64 = b64url(pubKey);

  const encrypted = await encryptPayload(
    JSON.stringify(payloadObj),
    b64urlDec(subscription.keys.p256dh),
    b64urlDec(subscription.keys.auth));

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Urgency': 'normal',
      'Authorization': `vapid t=${vapidToken}, k=${vapidKeyB64}`,
    },
    body: encrypted
  });
  return res.status;
}

// Subscriber records auto-expire if a device never re-uploads its schedule
// (each app open refreshes the TTL). Keeps KV free of dead subscriptions.
const SUB_TTL_SECONDS = 45 * 24 * 3600;

// KV list() returns at most 1000 keys per page — walk the cursor so we never
// silently skip subscribers once the install base grows.
async function listAllSubKeys(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.PUSH_SUBS.list(cursor ? { cursor } : {});
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

// ====== CRON DISPATCHER ======
// Each subscriber record holds a client-computed schedule of absolute-time
// events: { tag, title, body, url, ts }. The client (which already runs adhan.js)
// uploads ~7 days ahead via /subscribe. This handler — invoked by the Cloudflare
// cron trigger every minute — fires whatever has come due since last run. No
// prayer-time math lives on the server.
async function dispatchDue(env) {
  const now = Date.now();
  const MAX_LATE = 15 * 60 * 1000; // don't fire events that are >15 min stale (e.g. after a cron outage)

  const keys = await listAllSubKeys(env);
  await Promise.all(keys.map(async ({ name }) => {
    const raw = await env.PUSH_SUBS.get(name);
    if (!raw) return;

    let rec;
    try { rec = JSON.parse(raw); } catch { return; }

    // Backward compat: legacy records were the bare subscription object
    const subscription = rec.subscription || rec;
    const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
    if (!subscription || !subscription.endpoint || !schedule.length) return;

    const cursor = rec.lastDispatch || 0;
    const due = schedule.filter(e => e.ts <= now && e.ts > cursor && e.ts > now - MAX_LATE);
    if (!due.length) return;

    let gone = false;
    for (const e of due) {
      try {
        const status = await sendPushToSubscriber(env, subscription, {
          title: e.title || '🔔 زاد المسلم',
          body:  e.body  || '',
          tag:   e.tag   || 'zad-muslim',
          data:  { url: e.url || './index.html', type: e.tag || 'default' }
        });
        if (status === 410 || status === 404) { gone = true; break; }
      } catch { /* transient — will retry next minute if still within MAX_LATE */ }
    }

    if (gone) { await env.PUSH_SUBS.delete(name); return; }

    // Advance cursor and drop events that are now in the past
    rec.subscription = subscription;
    rec.schedule = schedule.filter(e => e.ts > now);
    rec.lastDispatch = now;
    await env.PUSH_SUBS.put(name, JSON.stringify(rec), { expirationTtl: SUB_TTL_SECONDS });
  }));
}

// ====== MAIN ======

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /vapidPublicKey
    if (url.pathname === '/vapidPublicKey' && request.method === 'GET') {
      return new Response(JSON.stringify({ key: env.VAPID_PUBLIC_KEY }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /kvcount — debug endpoint to check KV entries
    if (url.pathname === '/kvcount' && request.method === 'GET') {
      const keys = await listAllSubKeys(env);
      return new Response(JSON.stringify({ count: keys.length, names: keys.map(k => k.name) }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /kvclean — admin: delete ALL KV entries (for testing)
    if (url.pathname === '/kvclean' && request.method === 'POST') {
      if (!env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ success: false, error: 'ADMIN_TOKEN not configured' }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const auth = request.headers.get('Authorization') || '';
      if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const keys = await listAllSubKeys(env);
      await Promise.all(keys.map(k => env.PUSH_SUBS.delete(k.name)));
      return new Response(JSON.stringify({ success: true, deleted: keys.length }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /subscribe — upsert subscription + its precomputed notification schedule
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const body = await request.json();
      const { subscription, userId, schedule, tzOffset } = body;
      if (!subscription) {
        return new Response(JSON.stringify({ success: false, error: 'Missing subscription' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const key = userId || subscription.endpoint;

      // Preserve the dispatch cursor across re-uploads so already-fired events don't repeat
      let lastDispatch = 0;
      const prev = await env.PUSH_SUBS.get(key);
      if (prev) { try { lastDispatch = (JSON.parse(prev).lastDispatch) || 0; } catch {} }

      const rec = {
        subscription,
        schedule: Array.isArray(schedule) ? schedule : [],
        tzOffset: typeof tzOffset === 'number' ? tzOffset : 0,
        lastDispatch,
        updated: Date.now()
      };
      await env.PUSH_SUBS.put(key, JSON.stringify(rec), { expirationTtl: SUB_TTL_SECONDS });

      return new Response(JSON.stringify({ success: true, events: rec.schedule.length }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /unsubscribe
    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      const body = await request.json();
      const key = body.userId || body.endpoint;
      if (key) await env.PUSH_SUBS.delete(key);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /notify — admin broadcast: send one encrypted push to ALL subscribers.
    // Guarded by the ADMIN_TOKEN secret (wrangler secret put ADMIN_TOKEN) —
    // without a guard, anyone who finds the URL can spam every device.
    if (url.pathname === '/notify' && request.method === 'POST') {
      if (!env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ success: false, error: 'ADMIN_TOKEN not configured' }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const auth = request.headers.get('Authorization') || '';
      if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const body = await request.json();

      const payload = {
        title: body.title || '🔔 Zad Al-Muslim',
        body: body.body || '',
        tag: body.tag || 'zad-muslim',
        data: body.data || { url: './index.html', type: 'default' }
      };

      const allSubs = await listAllSubKeys(env);
      let sent = 0, failed = 0;

      await Promise.all(allSubs.map(async ({ name }) => {
        const raw = await env.PUSH_SUBS.get(name);
        if (!raw) { failed++; return; }
        try {
          const rec = JSON.parse(raw);
          const subscription = rec.subscription || rec; // tolerate legacy bare-subscription records
          const status = await sendPushToSubscriber(env, subscription, payload);
          if (status >= 200 && status < 300) sent++;
          else {
            if (status === 410 || status === 404) await env.PUSH_SUBS.delete(name);
            failed++;
          }
        } catch { failed++; }
      }));

      return new Response(JSON.stringify({ success: true, sent, failed }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },

  // Cloudflare cron trigger (configure `crons = ["* * * * *"]` in wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchDue(env));
  }
};
