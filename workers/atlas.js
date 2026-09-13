const DROP = new Set([
  "connection",
  "content-encoding",
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
  gebco: {
    origin: "https://wms.gebco.net",
    cacheTtl: 86400,
    cacheEverything: true,
    timeoutMs: 20000,
    accept: "image/png,image/*,*/*",
  },
  gmrt: {
    origin: "https://www.gmrt.org",
    cacheTtl: 0,
    timeoutMs: 18000,
    accept: "text/plain,*/*",
  },
  hycom: {
    origin: "https://ncss.hycom.org",
    cacheTtl: 600,
    cacheEverything: true,
    timeoutMs: 12000,
    accept: "text/csv,text/plain,*/*",
  },
};

async function proxy(request, spec, prefix) {
  const incoming = new URL(request.url);
  const rest = incoming.pathname.slice(prefix.length) || "/";
  const target = spec.origin + rest + incoming.search;
  const headers = new Headers();
  headers.set("Accept", spec.accept || "*/*");
  headers.set("Accept-Encoding", "identity");
  headers.set("User-Agent", request.headers.get("User-Agent") || "untitled-ocean-simulation");

  const init = {
    method: "GET",
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(spec.timeoutMs || 20000),
  };
  if (spec.cacheTtl > 0) {
    init.cf = { cacheTtl: spec.cacheTtl, cacheEverything: !!spec.cacheEverything };
  }

  let res;
  try {
    res = await fetch(target, init);
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    return new Response(`atlas upstream failed: ${err.message || err}`, {
      status: timedOut ? 504 : 502,
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
