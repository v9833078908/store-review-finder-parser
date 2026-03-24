# Search App Subpath Deploy Design

**Goal:** Deploy the current review parser application to `https://dev.tools.herocraft.com/search-app` so the entire user-facing app works under the `/search-app` prefix, including frontend routes and backend-facing API paths.

## Context

The repository already contains:
- a Python FastAPI backend on port `8000`
- a Next.js frontend in `frontend/`
- Docker support through the root `docker-compose.yml`

The target server `vibetools` runs Coolify with Traefik on `dev.tools.herocraft.com`. Existing routing already serves other apps on the same host, so this deployment must coexist by matching only the `/search-app` path prefix.

## Recommended Approach

Use a dedicated Coolify application with two services:
- `frontend` as the only public entrypoint
- `review-api` as an internal service reachable only inside the Coolify network

Traefik should route `PathPrefix(`/search-app`)` to the frontend service. The frontend itself must be built with a Next.js base path of `/search-app` so that:
- page routes resolve under `/search-app/...`
- static assets load from the same prefix
- client-side navigation keeps the prefix
- built-in Next route handlers are exposed under `/search-app/api/...`

The frontend will continue to proxy or call backend functionality through its existing Next route handlers. Those route handlers will use an internal backend URL such as `http://review-api:8000`, not the public domain.

## Why This Approach

This is the most stable option because it matches how Next.js expects subpath deployments to work. Pure proxy-only rewriting would likely break links, assets, redirects, and route handlers. A separate subdomain would be simpler operationally, but it does not meet the deployment requirement.

## Routing Model

Public:
- `https://dev.tools.herocraft.com/search-app`
- `https://dev.tools.herocraft.com/search-app/...`
- `https://dev.tools.herocraft.com/search-app/api/...`

Internal:
- `frontend` container serves the Next app
- `review-api` container serves FastAPI on port `8000`
- frontend route handlers call `review-api` over the internal Docker network

Traefik behavior:
- match only `PathPrefix(`/search-app`)`
- strip no prefix at the edge if the app is built with `basePath=/search-app`
- keep the original request path intact so Next receives `/search-app/...`

## Required Application Changes

### Frontend

- Add `basePath=/search-app` support in `frontend/next.config.ts`
- ensure any redirects and hardcoded links remain prefix-safe
- verify route handlers and client fetches still resolve under `/search-app/api/...`
- keep internal backend communication pointed at the backend service name

### Backend

- no path-prefix awareness should be required for direct internal traffic
- keep backend private to the Coolify network unless a debugging need appears
- update CORS to allow the production origin `https://dev.tools.herocraft.com`

### Docker / Deployment

- prepare deployment-specific environment variables
- reuse the existing root Docker setup if possible
- expose only the frontend publicly through Coolify
- configure a health check for both services where supported

## Risks

- hardcoded absolute paths in frontend code may bypass `basePath`
- Next route handlers may assume root deployment if URLs are manually assembled
- existing CORS configuration may reject the production host
- Coolify path routing must not conflict with existing `/image_loc` route on the same domain

## Validation

Successful deployment means:
- `/search-app` loads
- internal navigation stays under `/search-app/...`
- static assets return `200`
- frontend API calls succeed via `/search-app/api/...`
- report generation reaches the backend successfully
- existing `dev.tools.herocraft.com` routes outside `/search-app` remain unaffected
