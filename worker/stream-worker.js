const ALLOWED_PREFIXES = ['/smcquranlive/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const path = url.pathname;
    if (path === '/' || path === '') {
      return new Response('Quran Stream Proxy', {
        status: 200,
        headers: { 'Content-Type': 'text/plain', ...corsHeaders }
      });
    }

    // Only the stations the app plays (js/radio-stations.js); the playlist's
    // chunklists and segments live under the same prefix. Anything else would
    // make this an open relay on our Cloudflare quota.
    if (!ALLOWED_PREFIXES.some(p => path.startsWith(p)) || path.includes('..') ||
        (request.method !== 'GET' && request.method !== 'HEAD')) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const upstreamUrl = `https://svs.itworkscdn.net${path}${url.search}`;

    // Forward only what streaming needs — never the client's cookies, auth or
    // Cloudflare headers.
    const fwd = new Headers();
    const range = request.headers.get('Range');
    if (range) fwd.set('Range', range);
    fwd.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0');

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: fwd,
    });

    const responseHeaders = new Headers(upstreamResponse.headers);

    let contentType = upstreamResponse.headers.get('Content-Type') || '';
    if (!contentType || contentType === 'application/octet-stream' || contentType === 'application/x-mpegURL') {
      if (path.endsWith('.m3u8')) {
        contentType = 'application/vnd.apple.mpegurl';
      } else if (path.endsWith('.ts')) {
        contentType = 'video/MP2T';
      } else if (path.endsWith('.aac') || path.endsWith('.m4a')) {
        contentType = 'audio/aac';
      }
    }
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.delete('Set-Cookie');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  }
};
