# review-parser

Единый монорепозиторий для анализа отзывов Google Play и генерации дашборда качества.

`README.md` в этом каталоге является единственным каноническим README для всего проекта:
- Python backend (unified pipeline + FastAPI API)
- `frontend` (Next.js unified UI, порт `51200`)
- `lead-finder` (legacy Next.js app, порт `51100`, оставлен для обратной совместимости)

## Architecture

Основной поток данных:

1. Пользователь открывает `/search-app` в `frontend`.
2. На `search-app` доступны два сценария:
   - scan по каталогу Google Play (lead finder parity),
   - акцентный direct-input для Google Play и App Store.
3. Пользователь формирует отчет по выбранной игре.
4. `frontend` открывает экран отчета и запускает SSE-запрос в Python API (`/api/report`) через BFF proxy.
5. Backend выполняет unified pipeline:
   - `run_theme_extraction` + `run_classification` (параллельно),
   - `detect_alerts` (локально),
   - generation of structured `report_layers` (`summary`, `signals`, `issues`, `actions`) + structured artifact.
6. UI отображает прогресс SSE и переводит пользователя в `/command-center?lang=...&period=...`.

Ключевой принцип: JSON structured data является основным источником для UI.  
`markdown` сохраняется только как backward-compatible/deprecated export.

## Ports and Environment

| Service | Default Port | Notes |
|---|---:|---|
| `frontend` | `51200` | Unified UI (`/search-app`, `/command-center`) |
| `review-api` (FastAPI) | `8000` | SSE + sync endpoints |
| `lead-finder` | `51100` | Legacy scan UI (optional) |

### Required environment variables

Файл `.env` (на уровень выше `review-parser`):

```env
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

Frontend env examples:
- `lead-finder/.env.example`
- `frontend/.env.example`

Recommended values:

```env
# frontend
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_API_URL=http://localhost:8000
INTERNAL_API_URL=http://localhost:8000
```

Backend CORS:

```env
CORS_ORIGINS=http://localhost:51100,http://127.0.0.1:51100,http://localhost:51200,http://127.0.0.1:51200
```

Coolify subpath deployment on `https://dev.tools.herocraft.com/search-app`:

```env
NEXT_PUBLIC_BASE_PATH=/search-app
NEXT_PUBLIC_API_URL=https://dev.tools.herocraft.com/search-app/api
INTERNAL_API_URL=http://review-api:8000
CORS_ORIGINS=https://dev.tools.herocraft.com
```

## Quick Start (Local)

Prerequisites:
- Python 3.10+
- Node.js 18+
- npm

### 1) Setup backend

```bash
cd review-parser
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2) Run API server

```bash
cd review-parser
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000
```

Check health:

```bash
curl "http://localhost:8000/health"
```

### 3) Run Unified Frontend

```bash
cd review-parser/frontend
npm install
npm run dev
```

Open: `http://localhost:51200/search-app`

Direct report input on `/search-app`:
- `Google Play`: URL details/search or package/query resolve flow
- `App Store`: numeric `app_id` only (example: `123456789`)

### 4) Optional: Run legacy Lead Finder (backward compatibility only)

```bash
cd review-parser/lead-finder
npm install
npm run dev
```

Open: `http://localhost:51100`

## Quick Start (Docker)

### Build images

```bash
cd review-parser
docker compose build
```

### Run full stack (API + Unified Frontend [+ legacy Lead Finder])

```bash
docker compose up -d
```

Open:
- `http://localhost:51200/search-app` — unified entrypoint
- `http://localhost:51100` — legacy lead-finder (optional)
- `http://localhost:8000/health` — backend health

### Run full stack + ngrok tunnel

Set in `.env`:

```env
NGROK_AUTHTOKEN=...
NGROK_URL=https://unserenaded-nonresponsibly-haydee.ngrok-free.dev
NGROK_INSPECT_PORT=4041
```

Run:

```bash
docker compose --profile tunnel up -d
```

Inspect ngrok:
- API: `http://localhost:4041/api/tunnels`
- Logs: `docker compose logs -f ngrok`

### Run batch unified report (CLI container)

```bash
docker compose --profile cli run --rm review-parser \
  "https://play.google.com/store/apps/details?id=com.herocraft.game.tempest.lite" \
  --max-reviews 300 \
  --langs en,ru \
  --country us \
  --mode unified
```

## E2E User Flow

1. Открыть `frontend` на `http://localhost:51200/search-app`.
2. Либо запустить catalog scan, либо вставить Google Play URL/search URL.
3. Выбрать игру и нажать `Сформировать отчет`.
4. Откроется новая вкладка с генерацией отчета через SSE.
5. После завершения прогресса отобразится dashboard на `/command-center` с секциями:
   - Command Center
   - Issues
   - Reviews
   - Alerts

## API Contract

### `GET /health`

Простой liveness endpoint.

### `GET /api/report/sync`

Синхронная генерация отчета. Основные query params:
- `url` (required)
- `store` (`google_play|app_store`, optional, default `google_play`)
- `max_reviews`
- `langs`
- `country`
- `force_refresh`
- `cache_ttl_hours`

### `GET /api/report` (SSE)

Стримит JSON envelope в `data`:

```json
{"type":"status","step":"resolved","package":"...","title":"..."}
{"type":"status","step":"fetching"}
{"type":"status","step":"fetched","count":300}
{"type":"progress","pipeline":"themes","current":3,"total":6}
{"type":"progress","pipeline":"classify","current":5,"total":10}
{"type":"status","step":"analyzed"}
{"type":"report","data":{"run_id":"...","report_layers":{...},"markdown":"...","artifact_path":"..."}}
{"type":"done"}
```

### `GET /api/resolve/app-store`

Resolve numeric App Store `app_id` into a single candidate for direct report generation.

Query params:
- `app_id` (required, numeric)
- `country` (optional, default `us`)

Notes:
- App Store catalog scan is not implemented
- App Store direct reports are limited to up to `500` newest reviews for MVP

### `GET /api/runs` (run history list)

Возвращает список последних run-артефактов для переключения между генерациями в дашборде.

Query params:
- `package_name` (optional) — фильтр по пакету
- `limit` (optional, default `10`, range `1..50`) — кол-во результатов

Response:
```json
{
  "items": [
    {
      "run_id": "810c2dabed73",
      "package_name": "com.example.app",
      "app_name": "My App",
      "saved_at": "2026-02-17T14:23:09Z",
      "country": "us",
      "window_mode": "7d",
      "reviews_selected": 300
    }
  ],
  "count": 1
}
```

Список отсортирован по времени сохранения (новые первые). Битые JSON-файлы пропускаются.

#### Shared usage via `run_id`

Чтобы поделиться конкретной генерацией с коллегой через ngrok, скопируй URL дашборда — в нём уже есть `?run_id=...`.
Коллега откроет тот же `run_id` без настройки localStorage.

Переключение между генерациями:
1. Header дашборда показывает dropdown с последними 10 run'ами текущего приложения.
2. При выборе run URL обновляется (`?run_id=...`), прочие фильтры (`lang`, `period`, `from`, `to`) сохраняются.
3. Кнопка **Refresh** рядом с dropdown подгружает свежие run'ы, сгенерированные коллегами — без перезагрузки страницы.

### `GET /api/runs/{run_id}` (hydration contract for dashboard)

Endpoint для загрузки полного structured artifact по `run_id` для восстановления состояния dashboard.
Ключевые поля для единого layered-report:
- `report_layers.summary`
- `report_layers.signals`
- `report_layers.issues`
- `report_layers.actions`

### `GET /api/dashboard-config`

Получить конфигурацию dashboard по scope:
- `package_name` (required)
- `role_profile` (`producer|support|engineering`, optional, default `producer`)

### `PUT /api/dashboard-config`

Сохранить конфигурацию dashboard по scope (`package_name`, `role_profile`).
Payload:
- `visible_tabs`
- `tab_order`
- `visible_widgets`
- `kpi_set`
- `version`

### `GET /api/scan` (SSE)

SSE endpoint для catalog lead-finder scan (parity flow): стримит `progress`, `result`, `error`, `done`.

### `GET /api/scan/sync`

Синхронный scan endpoint для отладки/контрактных тестов.

### `GET /api/resolve/google-play`

Resolve endpoint для direct URL flow (`details URL`, `search URL`, `package`), возвращает shortlist кандидатов и `recommended_app_id`.

## Data and Artifacts

- Review cache: `review-parser/data/*.json`
- Version history: `review-parser/data/*_versions.json`
- Structured runs: `review-parser/data/runs/*.json`
- Dashboard configs: `review-parser/data/dashboard-configs/*.json`
- Markdown reports: `review-parser/reports/*.md`
- Legacy alert reports: `review-parser/reports/alerts/*.md`

## Troubleshooting

### CORS errors from browser

Проверь `CORS_ORIGINS` в backend и убедись, что origin frontend/lead-finder добавлен.

### Empty or stale results

Используй:
- `force_refresh=true`
- меньший `cache_ttl_hours` (например `1`)

### SSE disconnects

- Проверь, что API жив (`/health`).
- Убедись, что прокси/туннель не разрывает long-lived connections.
- При обрыве перезапусти запрос генерации отчета.

### No report generated

Проверь:
- `ANTHROPIC_API_KEY`
- сетевой доступ к Anthropic API
- логи backend (`uvicorn`/docker logs)

## Detailed Documentation

- Unified migration plan: `docs/unified-review-dashboard-plan.md`
- Frontend design: `docs/frontend-design-plan.md`
- Alert mode legacy notes: `docs/alert-mode-usage.md`
- Lead finder implementation plan: `docs/lead-finder-plan.md`
- Product/architecture brief (RU): `docs/ТЗ на реализацию дашборда.md`
