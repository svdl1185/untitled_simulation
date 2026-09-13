const DROP = new Set([
  "connection",
  "content-length",
  "content-security-policy",
  "content-security-policy-report-only",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-frame-options",
]);

function suffix(params) {
  const parts = params?.path;
  if (!parts) return "/";
  if (Array.isArray(parts)) return `/${parts.join("/")}`;
  return `/${parts}`;
}

/** Same-origin atlas proxy. Vite uses these origins in `server.proxy` / `preview.proxy`. */
export function createProxy(origin, { cacheTtl = 0 } = {}) {
  return async (context) => {
    const incoming = new URL(context.request.url);
    const target = `${origin}${suffix(context.params)}${incoming.search}`;
    const headers = new Headers();
    const accept = context.request.headers.get("Accept");
    if (accept) headers.set("Accept", accept);
    headers.set(
      "User-Agent",
      context.request.headers.get("User-Agent") || "untitled-ocean-simulation"
    );

    const init = { method: "GET", headers, redirect: "follow" };
    if (cacheTtl > 0) init.cf = { cacheTtl, cacheEverything: true };

    let res;
    try {
      res = await fetch(target, init);
    } catch (err) {
      return new Response(`atlas upstream failed: ${err.message || err}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const out = new Headers();
    for (const [key, value] of res.headers) {
      if (DROP.has(key.toLowerCase())) continue;
      out.set(key, value);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: out,
    });
  };
}
