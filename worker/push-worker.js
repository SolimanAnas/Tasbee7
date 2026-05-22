function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDec(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// ====== HKDF context for aes128gcm (RFC 8188 + RFC 8291) ======
// cek_info  = "Content-Encoding: aes128gcm\0" + sub_pub(65) + server_pub(65)
// nonce_info = "Content-Encoding: nonce\0"     + sub_pub(65) + server_pub(65)

function hkdfInfo(type, subPub, serverPub) {
  const name = new TextEncoder().encode(`Content-Encoding: ${type}\0`);
  const out = new Uint8Array(name.length + subPub.length + serverPub.length);
  out.set(name, 0);
  out.set(subPub, name.length);
  out.set(serverPub, name.length + subPub.length);
  return out;
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

  // 5. Derive keys via HKDF (RFC 8291 §3.4)
  // PRK = HKDF-Extract(salt=auth, IKM=shared_secret)
  // CEK = HKDF-Expand(PRK, cek_info, 16)
  // NONCE = HKDF-Expand(PRK, nonce_info, 12)
  const ikmKey = await crypto.subtle.importKey(
    'raw', sharedSecret, 'HKDF', false, ['deriveBits']);

  const cek = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: subAuth,
      info: hkdfInfo('aes128gcm', subRaw, serverPub) },
    ikmKey, 128);

  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: subAuth,
      info: hkdfInfo('nonce', subRaw, serverPub) },
    ikmKey, 96);

  // 6. Pad payload (RFC 8188 §2.1): 2-byte big-endian padding delimiter
  const payloadBytes = new TextEncoder().encode(text);
  const record = new Uint8Array(payloadBytes.length + 2);
  record[0] = 0; record[1] = 0; // no padding
  record.set(payloadBytes, 2);

  // 7. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey(
    'raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce), tagLength: 128 },
    aesKey, record));

  // 8. Build output: salt(16) || recordSize(4) || serverPub(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, ciphertext.length, false);

  const out = new Uint8Array(16 + 4 + 65 + ciphertext.length);
  out.set(salt, 0);
  out.set(rs, 16);
  out.set(serverPub, 20);
  out.set(ciphertext, 85);
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

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: 'mailto:admin@zad-al-muslim.com'
  };

  const enc = new TextEncoder();
  const toSign = enc.encode(
    b64url(enc.encode(JSON.stringify(header))) + '.' +
    b64url(enc.encode(JSON.stringify(payload))));

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, toSign);

  // Web Crypto returns raw r||s (64 bytes for P-256) — ready to use as-is
  return b64url(new Uint8Array(sig));
}

// ====== MAIN ======

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
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

    // POST /subscribe
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const body = await request.json();
      const { subscription, userId } = body;
      if (!subscription) {
        return new Response(JSON.stringify({ success: false, error: 'Missing subscription' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await env.PUSH_SUBS.put(userId || subscription.endpoint, JSON.stringify(subscription));
      return new Response(JSON.stringify({ success: true }), {
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

    // POST /notify — send encrypted push to ALL subscribers
    if (url.pathname === '/notify' && request.method === 'POST') {
      const body = await request.json();
      const privKey = b64urlDec(env.VAPID_PRIVATE_KEY);
      const pubKey = b64urlDec(env.VAPID_PUBLIC_KEY);

      const payload = {
        title: body.title || '🔔 Zad Al-Muslim',
        body: body.body || '',
        tag: body.tag || 'zad-muslim',
        data: body.data || { url: './index.html', type: 'default' }
      };
      const payloadStr = JSON.stringify(payload);

      const allSubs = await env.PUSH_SUBS.list();
      let sent = 0, failed = 0;

      await Promise.all(allSubs.keys.map(async ({ name }) => {
        const raw = await env.PUSH_SUBS.get(name);
        if (!raw) { failed++; return; }
        try {
          const sub = JSON.parse(raw);

          // VAPID aud = push endpoint origin (varies per browser)
          const aud = new URL(sub.endpoint).origin;
          const vapidToken = await signVapid(privKey, pubKey, aud);
          const vapidKeyB64 = b64url(pubKey);

          // Encrypt payload
          const encrypted = await encryptPayload(
            payloadStr,
            b64urlDec(sub.keys.p256dh),
            b64urlDec(sub.keys.auth));

          // Send
          const res = await fetch(sub.endpoint, {
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

          if (res.ok) sent++;
          else {
            if (res.status === 410 || res.status === 404) await env.PUSH_SUBS.delete(name);
            failed++;
          }
        } catch { failed++; }
      }));

      return new Response(JSON.stringify({ success: true, sent, failed }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
