import { definePlugin as defineNitroPlugin } from 'nitro';

export default defineNitroPlugin((nitroApp) => {
  const originalFetch = nitroApp.fetch.bind(nitroApp);

  nitroApp.fetch = async (req) => {
    const res = await originalFetch(req);

    const webUrl = process.env.WEB_URL;
    if (!webUrl) return res;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return res;

    const body = await res.text();
    const absoluteImageUrl = new URL('/og-image.png', webUrl).toString();
    const rewritten = body.replace(/content="\/og-image\.png"/g, `content="${absoluteImageUrl}"`);

    const headers = new Headers(res.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');

    return new Response(rewritten, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
});
