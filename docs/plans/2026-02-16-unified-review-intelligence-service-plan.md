# Unified Review Intelligence Service (Lead Finder + Review Analytics)

## Summary
Объединяем текущие `lead-finder` и `frontend` в один пользовательский сервис с обязательным маршрутом:
1. вход: `/search-app`
2. сценарий A: поиск по каталогу Google Play (без деградации текущей механики)
3. сценарий B: акцентная вставка URL Google Play (Apple — только UI-заглушка)
4. переход: формирование отчета и открытие `/command-center?lang=en&period=7d` с реальными кликабельными данными

Техническая цель: единый Next.js клиент + единое FastAPI backend-ядро (`scan + report + runs`) под одним публичным доменом.

## Current-State Facts
1. На текущем ngrok-домене `https://unserenaded-nonresponsibly-haydee.ngrok-free.dev/search-app` возвращает `404` (проверено 2026-02-16).
2. `command-center` доступен и рендерится.
3. Сейчас логика split:
   1. `lead-finder` (Next, порт 51100): scan pipeline и таблица лидов.
   2. `frontend` (Next, порт 51200): report/command-center.
   3. `server.py` (FastAPI, порт 8000): `/api/report`, `/api/report/sync`, `/api/runs/{run_id}`.
4. Сейчас уже есть переход из lead-finder в отчет, но это не единый UI-контур и не единый backend для scan.

## Target Architecture
1. Единый UI-контур на базе `frontend`:
   1. Новый основной маршрут `/search-app`.
   2. Сохраняем `/command-center` и query-контракт `lang`, `period`.
   3. `/` редиректит на `/search-app`.
2. Единое backend-ядро в FastAPI:
   1. Перенос scan pipeline из `lead-finder/src/app/api/scan/route.ts` в Python модуль FastAPI.
   2. Report pipeline остается в FastAPI, расширяется контрактами для unified flow.
3. Один внешний origin:
   1. Browser ходит только в Next-origin.
   2. Next route handlers выступают как BFF/proxy в FastAPI (внутренний URL), чтобы снаружи оставался один сервис.
4. Контекст запуска отчета:
   1. `run_id` хранится per-tab в `sessionStorage` (не cookie).
   2. `command-center` читает `run_id` из `sessionStorage`, URL остается чистым (`lang`, `period`).
   3. Multi-tab безопасен: каждая вкладка хранит собственный активный run.

## Backend Plan (FastAPI)
1. Добавить scan API в `server.py`:
   1. `GET /api/scan` (SSE): события `progress|result|error|done` в формате lead-finder.
   2. `GET /api/scan/sync` (для контрактных тестов и отладки).
2. Вынести scan-логику из JS в Python с parity:
   1. Новый модуль `lead_scan.py` с эквивалентами:
      1. fetch top apps
      2. fetch app details
      3. fetch reviews
      4. analyze reviews
      5. calculate lead score
   2. Сохранить формулы и поля результата 1:1.
   3. Сохранить order CSV-колонок 1:1.
3. Добавить URL resolve для акцентной вставки:
   1. `GET /api/resolve/google-play?input=<url_or_package>`
   2. Возвращает shortlist кандидатов (top-N), помечает `top_1`.
   3. Поддерживает `details URL`, `search URL`, `package`.
4. Report API расширяем без breaking:
   1. Сохраняем `/api/report`, `/api/report/sync`, `/api/runs/{run_id}`.
   2. Добавляем контекст запуска (`source=direct_url|catalog` и package metadata) в artifact.
5. Политика данных command-center:
   1. Только реальные данные из run artifact.
   2. Убираем mock fallback для production path.
   3. При ошибке fetch: явный error + retry action.

## Frontend Plan (Single Next App)
1. Новый маршрут `/search-app` в `frontend/src/app/search-app/page.tsx`:
   1. Верхний акцентный блок `Paste Google Play URL`.
   2. Ниже блок scan-фильтров (текущая механика lead-finder без деградации).
   3. Таблица выдачи с теми же колонками, сортировками, бейджами и CSV-export.
2. Сценарий “из выдачи сформировать отчет”:
   1. В каждой строке action “Сформировать отчет”.
   2. Открытие в новой вкладке сохраняется.
   3. Передаем `appId/url + country/lang/maxReviews`.
   4. Запускаем fresh-run report pipeline.
3. Сценарий вставки search URL:
   1. Автовыбор top-1.
   2. Показываем подтверждение выбранной игры + быстрый выбор альтернативы.
   3. После подтверждения запускаем report generation.
4. Переход в command center:
   1. `report` page получает `run_id`.
   2. Пишет `run_id` в `sessionStorage`.
   3. Redirect на `/command-center?lang=<...>&period=<...>`.
5. Обновить `useDashboardData`:
   1. Приоритет источника `run_id`: query (если есть) -> sessionStorage.
   2. Убрать mock fallback.
   3. Явно показывать “нет активного run” если отчет не запускался.

## Public APIs / Interfaces / Types
1. Новые backend endpoints:
   1. `GET /api/scan` (SSE)
   2. `GET /api/scan/sync`
   3. `GET /api/resolve/google-play`
2. Сохраняемые контракты:
   1. `GET /api/report`
   2. `GET /api/report/sync`
   3. `GET /api/runs/{run_id}`
3. Type additions (frontend):
   1. `ResolvedAppCandidate { app_id, title, url, score, reviews_count, is_top1 }`
   2. `ResolveResponse { input_type, candidates, recommended_app_id }`
   3. `ScanResult` и `ScanEvent` в общей shared схеме.
4. Session keys:
   1. `review-dashboard:active-run-id:tab:v1`
   2. `review-dashboard:last-report-context:v1`

## Assumptions and Defaults
1. Целевой подход: `One Next + FastAPI Core`.
2. URL-контракт сохраняем: вход `/search-app`, отчет `/command-center?lang=<...>&period=<...>`.
3. Catalog lead-finder функционал сохраняется без деградации (полная поведенческая parity).
4. Из выдачи каталога обязателен action формирования отчета по выбранной игре.
5. Открытие отчета из выдачи остается в новой вкладке.
6. Контекст run: per-tab `sessionStorage`, не cookie.
7. `command-center` показывает только real/clickable данные, без mock fallback.
8. Report из каталога всегда через fresh fetch.
9. Наследование параметров в report из scan: `country + lang + maxReviews`.
10. Apple Store: только UI-заглушка, без backend реализации на этом этапе.
11. Нагрузка: low (1-3 users), без сложной распределенной очереди.
12. Auth: отсутствует на этом этапе.
