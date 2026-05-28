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

    const upstreamUrl = `https://svs.itworkscdn.net${path}${url.search}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: request.headers,
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
