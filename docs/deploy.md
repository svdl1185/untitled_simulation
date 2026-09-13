# Deploy

The simulation is a Vite SPA plus three same-origin atlas paths. Cloudflare Pages is the host because the domain is already on Cloudflare, the build is static, and Pages Functions can stand in for the Vite proxies that GEBCO / GMRT / HYCOM need (those origins do not send CORS headers a browser can use).

Locally: `npm run dev` (Vite proxy) or `npm run preview` (same proxy on the production bundle). Edge-shaped check: `npm run preview:pages` after `npx wrangler login`.

## 1. Code is on GitHub

Repo: [svdl1185/untitled_simulation](https://github.com/svdl1185/untitled_simulation). Production branch is `main`. A push to `main` is what Pages will build.

## 2. Create the Pages project

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) in the same Cloudflare account that holds the domain.
2. **Create** → **Pages** → **Connect to Git**.
3. Authorize the **Cloudflare Workers & Pages** GitHub app on `svdl1185` if asked, and grant it `untitled_simulation`.
4. Select that repository. Production branch: `main`.
5. Build settings:

| Field | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm test && npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (leave default) |
| Node version | `22` (from `.nvmrc`, or set env `NODE_VERSION=22`) |

6. **Save and Deploy**. First deploy takes a few minutes. The project will answer at `https://<project>.pages.dev`.

Pages Functions under `functions/` are bundled automatically. They only run on `/gebco/*`, `/gmrt/*`, `/hycom/*` (`public/_routes.json`). Static assets stay unlimited.

## 3. Attach the domain

The domain is already in this Cloudflare account, so DNS does not leave Cloudflare.

1. Open the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter the apex (`example.org`) or `www` — whichever you bought and want as the public URL.
3. Cloudflare will add the CNAME (or flattened ALIAS on the apex) in that zone. Keep the record **proxied** (orange cloud).
4. Wait for the certificate (usually minutes). Apex and `www` can both point here; pick one as canonical if you add a redirect later.

No `CNAME` file in this repo. GitHub Pages is not in the path.

## 4. Check that the ocean is actually coupled

On the custom domain, not only `pages.dev`:

- The **world map** loads (GEBCO basemap via `/gebco/...`). Land polygons come from `/world/land-50m.json` in the bundle.
- Click a water cell. Floor comes from GMRT (`/gmrt/...`). Mean current from HYCOM (`/hycom/...`) when that service answers; otherwise the cell note says local tide/eddies only.
- **Lab** still opens the 10 km catalog tank (no atlas fetch).

If an atlas origin is down, the Functions return 502 and the existing client fallbacks apply. That is an upstream gap, not a missing mesh.

## 5. Later deploys

Every push to `main` rebuilds production. Pull requests get `*.pages.dev` preview URLs.

To publish once from this machine instead of Git:

```bash
npx wrangler login
npm test && npm run build
npx wrangler pages deploy dist --project-name untitled-ocean-simulation
```

`--project-name` must match the dashboard project. You still attach the domain in the dashboard (step 3).
