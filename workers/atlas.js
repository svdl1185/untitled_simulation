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

const UPSTREAM = {
  gebco: { origin: "https://wms.gebco.net", cacheTtl: 86400 },
  gmrt: { origin: "https://www.gmrt.org", cacheTtl: 86400 },
  hycom: { origin: "https://ncss.hycom.org", cacheTtl: 600 },
};

async function proxy(request, spec, prefix) {
  const incoming = new URL(request.url);
  const rest = incoming.pathname.slice(prefix.length) || "/";
  const target = spec.origin + rest + incoming.search;
  const headers = new Headers();
  const accept = request.headers.get("Accept");
  if (accept) headers.set("Accept", accept);
  headers.set("User-Agent", request.headers.get("User-Agent") || "untitled-ocean-simulation");

  const init = { method: "GET", headers, redirect: "follow" };
  if (spec.cacheTtl > 0) init.cf = { cacheTtl: spec.cacheTtl, cacheEverything: true };

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
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.pathname.split("/")[1];
    const spec = UPSTREAM[id];
    if (spec) return proxy(request, spec, `/${id}`);
    return env.ASSETS.fetch(request);
  },
};
