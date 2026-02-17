# Единый Dashboard + Единый Report (Tabs Layers) — Implementation Plan

**Дата:** 2026-02-16
**Статус:** Approved for implementation

## Краткое summary
1. Разделение на два независимых пользовательских отчета отменяется.
2. Остается один пользовательский контур: `Command Center` как главный экран.
3. Внутри единого отчета на Command Center добавляются табы-слои:
   - `Сводка`
   - `Сигналы`
   - `Проблемы`
   - `Действия`
4. Детальные страницы `/issues`, `/alerts`, `/reviews` остаются рабочими как drill-down.
5. Каноничный источник данных для UI: JSON/API. Markdown не является source of truth.

## Product Changes

### UX и навигация
1. `Command Center` остается центральным экраном (`frontend/src/app/command-center/page.tsx`).
2. Нижний report-блок переводится с plain markdown на tabbed layered report.
3. Текущие детальные маршруты не удаляются.

### Кастомизация v1 (обязательно)
1. Кастомизируются:
   - видимость/порядок табов отчета
   - видимость виджетов Command Center
   - состав KPI-метрик
2. Режим:
   - ролевой пресет (`producer`, `support`, `engineering`)
   - ручная настройка поверх пресета
3. Персистентность:
   - хранение через backend API
   - localStorage только fallback

## API / Contracts

### Новый контракт report-слоев
1. В `RunArtifact` добавить `report_layers`.
2. Слои:
   - `summary`
   - `signals`
   - `issues`
   - `actions`
3. Формат каждого слоя:
   - `title`
   - `narrative`
   - `cards`
   - `metrics`
   - `updated_at`

### Новый API конфигурации дашборда
1. `GET /api/dashboard-config`
2. `PUT /api/dashboard-config`
3. Scope:
   - `package_name`
   - `role_profile`
4. Payload:
   - `visible_tabs`
   - `tab_order`
   - `visible_widgets`
   - `kpi_set`
   - `version`

### Backward compatibility
1. `/api/report` и `/api/report/sync` продолжают отдавать `run_id`/artifact.
2. `markdown` остается как deprecated поле на переходный период.
3. UI переходит на `report_layers`.

## Decision-Complete Implementation Tasks

### Этап 1. Backend report layers
1. `pipeline.py`
   - генерировать структурированные `report_layers`
   - поддержать 4 слоя
2. `server.py`
   - вернуть `report_layers` в `/api/report*`
   - добавить `GET/PUT /api/dashboard-config`
3. `storage.py`
   - сохранять `report_layers`
   - сохранять `dashboard_config_snapshot` в run artifact

### Этап 2. Backend model for customization
1. Добавить хранилище `data/dashboard-configs/`.
2. Формат config:
   - `package_name`
   - `role_profile`
   - `visible_tabs`
   - `tab_order`
   - `visible_widgets`
   - `kpi_set`
   - `updated_at`
3. Добавить валидацию ключей tabs/widgets/kpi.

### Этап 3. Frontend layered report
1. Добавить `frontend/src/components/report/layered-report.tsx`.
2. Встроить в `frontend/src/app/command-center/page.tsx` вместо markdown panel.
3. Обновить `frontend/src/lib/dashboard-types.ts`:
   - перейти с `markdown` на `reportLayers`.
4. Обновить `frontend/src/lib/runtime-mapper.ts`:
   - map `RunArtifact.report_layers` -> `DashboardData.reportLayers`.

### Этап 4. Frontend customization UI
1. Добавить Customize dashboard drawer/modal в Command Center.
2. Добавить:
   - переключатель role profile
   - тумблеры для tabs/widgets/kpi
3. Обновить `frontend/src/lib/dashboard-preferences.tsx`:
   - загрузка/сохранение config через API
   - localStorage fallback

### Этап 5. Docs
1. Обновить `README.md`:
   - единый dashboard/report
   - `report_layers`
   - API config endpoints
2. Обновить `docs/ТЗ на реализацию дашборда.md`:
   - один report внутри одного dashboard
   - кастомизация через API и ролевые пресеты

## Tests and Acceptance

### Backend
1. Расширить `tests/test_server_report_routes.py`:
   - есть `report_layers`
   - есть deprecated `markdown`
2. Добавить тесты `dashboard-config` API:
   - дефолтный пресет на `GET`
   - save/reload на `PUT`
   - invalid keys -> reject

### Frontend
1. Tabs рендерятся строго по разрешенному набору.
2. Порядок табов соответствует конфигу.
3. Смена role profile меняет widgets/kpi.
4. Ручные изменения переживают reload.
5. `/issues`, `/alerts`, `/reviews` продолжают работать.

## Assumptions
1. JSON/API — canonical source for UI.
2. Drill-down страницы остаются.
3. Нет интеграций community/support в v1.
4. Дефолтный role profile: `producer`.
5. При отсутствии auth scope: `package_name + role_profile`.
