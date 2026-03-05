# План: История генераций и переключение run’ов для shared ngrok dashboard

## Summary
Цель: чтобы коллеги с разных ноутбуков видели уже сохранённые генерации и могли переключаться между ними (2, 3, 4+ run’ов) в общем UI.

Ключевой подход:
1. Источник истории переносим на сервер (не `localStorage`).
2. Переключатель размещаем в общем `Header` (для всех dashboard-табов).
3. Выбранный run всегда фиксируем в URL (`?run_id=...`) для шаринга.
4. В первой версии: только просмотр/переключение, без удаления, лимит 10 run’ов, ручной `Refresh`.

Перед реализацией:
1. Сохранить этот план в `review-parser/docs/plans/2026-02-17-run-history-switcher-design.md`.

## Варианты реализации (и выбор)
1. Клиентская история только в `localStorage`.
Плюсы: минимум кода.
Минусы: не работает между ноутбуками коллег.
2. Серверный список run’ов из файлов артефактов (выбрано).
Плюсы: общий источник правды для всех по ngrok, быстро внедряется в текущую архитектуру.
Минусы: чтение JSON-файлов при каждом запросе (при лимите 10 приемлемо).
3. Полный реестр в БД.
Плюсы: масштабируемость.
Минусы: лишняя инфраструктура для текущего scope.

## Публичные API / интерфейсы / типы
1. Новый backend endpoint: `GET /api/runs`.
Параметры:
- `package_name` (optional)
- `limit` (optional, default `10`, range `1..50`)
Ответ:
- `items: RunHistoryItem[]`
- `count: number`

2. Новый frontend proxy route: `review-parser/frontend/src/app/api/runs/route.ts`.
Поведение: проксирует `GET /api/runs` в backend с сохранением query params.

3. Новые фронтовые типы в `review-parser/frontend/src/lib/api-types.ts`:
- `RunHistoryItem`
- `RunHistoryResponse`

Рекомендуемая форма `RunHistoryItem`:
- `run_id: string`
- `package_name: string`
- `app_name: string`
- `saved_at?: string`
- `country?: string`
- `window_mode?: string`
- `reviews_selected?: number`
- `current_version?: string`
- `previous_version?: string`

## Детальный план реализации
1. Backend storage слой.
Файл: `review-parser/storage.py`.
Добавить:
- `list_run_artifacts(package_name: str | None = None, limit: int = 10) -> list[dict[str, Any]]`
- чтение `data/runs/*.json`, сортировка по `saved_at`/mtime убыванию
- фильтрация по `package_name` (если передан)
- безопасный skip битых JSON
- возврат только summary-полей (без full `reviews/classified`)

2. Backend API слой.
Файл: `review-parser/server.py`.
Добавить:
- `GET /api/runs` с валидацией limit
- вызов `list_run_artifacts(...)`
- ответ `{ "items": [...], "count": N }`

3. Frontend API proxy.
Файл: `review-parser/frontend/src/app/api/runs/route.ts`.
Добавить:
- GET handler, проксирование в `${getBackendUrl()}/api/runs`
- `cache: "no-store"`

4. Расширить data-hook.
Файл: `review-parser/frontend/src/hooks/use-dashboard-data.ts`.
Добавить:
- загрузку истории run’ов
- state: `runHistory`, `runHistoryLoading`, `runHistoryError`, `warning`
- fallback логика:
  - если `run_id` отсутствует в URL/localStorage: взять самый свежий run из `GET /api/runs?limit=10`
  - если `run_id` не найден: переключить на последний доступный + warning
- после загрузки активного artifact: подтянуть историю для текущего app через `package_name`
- сохранять активный run в local/session storage как и сейчас

5. Переключатель в Header.
Файл: `review-parser/frontend/src/components/layout/header.tsx`.
Изменения:
- добавить `Select` истории run’ов (в общем header)
- добавить кнопку `Refresh` списка
- при выборе run:
  - `router.replace()` текущего пути с обновлением `run_id`
  - сохранить прочие query (`lang`, `period`, `from`, `to`)
- label пункта: app + дата/время + короткий run id
- disabled state если история пуста

6. i18n.
Файл: `review-parser/frontend/src/lib/i18n.ts`.
Добавить ключи:
- `header.runHistory`
- `header.selectRun`
- `header.refreshRuns`
- `header.noRuns`
- `header.runNotFoundFallback`

7. UX ошибок/состояний.
Файлы: `review-parser/frontend/src/hooks/use-dashboard-data.ts`, `review-parser/frontend/src/components/layout/header.tsx`.
Поведение:
- если нет run’ов вообще: текущее empty state + CTA в Search App
- если fallback из невалидного `run_id`: не блокировать экран, показать warning banner

8. Документация.
Файл: `review-parser/README.md`.
Обновить:
- описание `GET /api/runs`
- сценарий shared usage через `run_id` в URL
- поведение refresh истории

## Тесты и сценарии
1. Backend unit/integration (`review-parser/tests/test_server_report_routes.py` + при необходимости новый `test_server_runs_routes.py`):
- `GET /api/runs` возвращает 200 и корректный contract
- сортировка убыванию по времени
- фильтр по `package_name`
- `limit=10` ограничивает выдачу
- невалидный `limit` -> 422
- битый JSON-файл не валит endpoint

2. Frontend smoke/manual QA:
- Открыть `/command-center` на новом ноутбуке без localStorage -> подгружается последний run автоматически
- В header видно до 10 run’ов текущего app
- Переключение run обновляет URL `?run_id=...` и перерисовывает все табы
- `Refresh` подхватывает новый run, созданный коллегой
- Невалидный `run_id` в URL -> fallback на последний доступный + warning

3. Regression checks:
- генерация из `/search-app` по-прежнему ведёт в `/command-center?run_id=...`
- локализация EN/RU не ломается
- фильтры периода и языка сохраняются при смене run

## Assumptions и выбранные defaults
- История в v1: только просмотр и переключение, без удаления run’ов.
- Лимит истории: 10.
- Scope истории: run’ы текущего app; если app ещё не определён, берём глобально самый свежий run как точку входа.
- Обновление истории между коллегами: вручную через `Refresh` (без polling/SSE).
- URL всегда источник шаринга выбранного run (`run_id` обязателен в ссылке для точного воспроизведения контекста).
