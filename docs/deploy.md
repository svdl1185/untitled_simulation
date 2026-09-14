# Deploy

The simulation is a Vite SPA plus three same-origin atlas paths. Host is a **Cloudflare Worker** with static assets (`dist`) because the domain is already on Cloudflare, and GEBCO / GMRT / HYCOM do not send CORS headers a browser can use. The Worker at `workers/atlas.js` proxies `/gebco/*`, `/gmrt/*`, `/hycom/*`. Everything else is the bundle.

The dashboard **Create an app** flow is this Worker Git integration (`npx wrangler deploy`), not classic Pages.

Locally: `npm run dev` (Vite proxy) or `npm run preview` (same proxy on the production bundle). Edge-shaped check: `npm run preview:pages` after `npx wrangler login`.

## 1. Code is on GitHub

Repo: [svdl1185/untitled_simulation](https://github.com/svdl1185/untitled_simulation). Production branch is `main`. A push to `main` is what Cloudflare builds.

`wrangler.toml` `name` must match the dashboard **Project name** (`untitled-simulation`).

## 2. Create the Worker from Git

On **Set up your application**:

| Field | Value |
| --- | --- |
| Project name | `untitled-simulation` |
| Build command | `npm test && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Builds for non-production branches | on (optional) |
| Non-production deploy command | `npx wrangler versions upload` (leave the default) |
| Path | `/` |
| API token | **Create new token** — leave the name empty; Cloudflare creates one |
| Variable name / value | leave empty |

Then **Deploy**. First URL: `https://untitled-simulation.<account>.workers.dev`.

## 3. Attach the domain

The domain is already in this Cloudflare account, so DNS does not leave Cloudflare.

1. Open the Worker → **Settings** → **Domains & Routes** (or **Custom domains**).
2. Add the apex (`example.org`) or `www`.
3. Keep the record **proxied** (orange cloud). Wait for the certificate.

No `CNAME` file in this repo.

## 4. Check that the ocean is actually coupled

On the custom domain, not only `workers.dev`:

- The **world map** loads (GEBCO basemap via `/gebco/...`). Land polygons come from `/world/land-50m.json` in the bundle.
- Click a water cell. Floor comes from GMRT (`/gmrt/...`). Mean current from HYCOM (`/hycom/...`) when that service answers; otherwise the cell note says local tide/eddies only.
- **Cells** opens named kilometres. The catalog tank is still the 10 km lab (no atlas fetch). Other tiles try GMRT at a known site and fall back to a synthetic floor.

If an atlas origin is down, the Worker returns 502 and the existing client fallbacks apply. That is an upstream gap, not a missing mesh.

## 5. Later deploys

Every push to `main` rebuilds production. Non-production branches get version previews if that box stayed checked.

To publish once from this machine instead of Git:

```bash
npx wrangler login
npm test && npm run build
npx wrangler deploy
```

You still attach the domain in the dashboard (step 3).
