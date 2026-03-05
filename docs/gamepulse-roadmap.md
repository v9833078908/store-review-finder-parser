# GamePulse Roadmap — от Vision v1 к реализации

> На основе [GamePulse Product Vision v1](file:///Users/eli/Downloads/Видение%20GamePulse_Product_Vision_v1.md) и анализа кодовой базы [review-parser](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser)

---

## Gap Analysis: Что есть vs. Что нужно

### ✅ Существующие активы

| Компонент | Файл(ы) | Статус |
|---|---|---|
| Google Play scraper | [scraper.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/scraper.py) | Рабочий, кеш, мульти-язык |
| Unified Pipeline | [pipeline.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/pipeline.py) | theme extraction + classification (параллельно) |
| Report Layers (JSON) | [report_layers.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/report_layers.py) | summary / signals / issues / actions |
| Alerts (спайки, кластеры) | [alerts.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/alerts.py) | Детекция на основе версий, локально |
| UnifiedFeedbackItem | [models.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/models.py) | DTO с bridge helpers, пока legacy dicts |
| Community classifier | [community/](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/community) | CSV → noise gate → topic classify (2-pass) |
| FastAPI Server + SSE | [server.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/server.py) | 34 endpoint-функции, SSE streaming |
| Next.js Dashboard | [frontend/](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/frontend) | `/search-app`, `/command-center`, `/alerts`, `/issues`, `/reviews` |
| Lead Scanner | [lead_scan.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/lead_scan.py) | Каталог GP + resolve URL |
| Тесты | [tests/](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/tests) | 4 файла (server routes, lead scan) |

### ❌ Что отсутствует (по Vision)

| Компонент | Фаза Vision | Описание |
|---|---|---|
| Apple App Store collector | Ф1 | iTunes RSS / App Store Connect API |
| Telegram → Pipeline мост | Ф1 | Чтение Google Sheets бота / прямой API |
| Кросс-анализ (store × social) | Ф1 | Промпт Claude для пересечений |
| UI кросс-анализа | Ф1 | Confirmed Issues, Blind Spots, Sentiment Gaps |
| PostgreSQL | Ф2 | Хранение, дедупликация, история |
| TeamWork интеграция (read) | Ф2 | Поиск тикетов по ключевым словам |
| LLM кеширование | Ф2 | Экономия на повторных запросах |
| Anomaly Detector (push) | Ф3 | Статистические всплески в реальном времени |
| Алерты в Telegram/Email | Ф3 | Push-уведомления команде |
| TeamWork auto-create | Ф3 | Автосоздание тикетов |
| Infra healthcheck | Ф3 | HTTP ping серверов |
| Grafana интеграция | Ф4 | Метрики latency, error rate |
| Гео-анализ | Ф4 | Регион по языку/юзернейму |
| Мультитенантность | Ф5 | Изоляция данных, onboarding |

---

## Предлагаемый Roadmap (GSD Milestones)

### 🏁 Milestone 1: Cross-Source MVP (Фаза 1 Vision)

**Цель:** Доказать ценность объединения сторов + Telegram в одном анализе.

**Бюджет:** 2–3 дня

#### Phase 1.1: Apple App Store Collector
- Создать `collectors/apple.py` — парсинг iTunes RSS feed
- Нормализация отзывов в `UnifiedFeedbackItem`
- Fallback при недоступности (partial results)

#### Phase 1.2: Telegram ↔ Pipeline Bridge
- Расширить `community/loader.py` → `collectors/telegram_sheets.py`
- Чтение из Google Sheets API (экспорт бота)
- Нормализация в `UnifiedFeedbackItem`

#### Phase 1.3: Cross-Analysis Prompt
- Новый промпт `prompts/cross_analysis.txt` для Claude
- Вход: unified items из GP + Apple + Telegram
- Выход: `confirmed_issues[]`, `store_blind_spots[]`, `chat_blind_spots[]`, `sentiment_gaps[]`

#### Phase 1.4: Pipeline Integration
- Расширить `pipeline.py` → опциональный `run_cross_analysis()` шаг
- Новый endpoint `/api/cross-report` (SSE)
- Результат в `report_layers` как дополнительный слой

#### Phase 1.5: UI — Cross-Analysis View
- Новая секция в `/command-center` (или отдельная вкладка)
- Карточки: Confirmed Issues / Store Blind Spots / Chat Blind Spots / Sentiment Gaps
- Индикация источника (иконки GP / Apple / TG)

---

### 🏁 Milestone 2: Persistent Storage + TeamWork (Фаза 2 Vision)

**Цель:** Накопительная система с привязкой к тикетам.

**Бюджет:** 5–7 дней

#### Phase 2.1: PostgreSQL Schema + Migration
- Таблицы: `feedback_items`, `analysis_runs`, `tw_tasks_cache`
- Alembic миграции
- Docker-compose с postgres сервисом

#### Phase 2.2: Storage Layer Refactor
- Замена JSON-файлового [storage.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/storage.py) на PostgreSQL
- Дедупликация по `(source, item_id)`
- Миграция существующих `data/runs/*.json`

#### Phase 2.3: Telegram Bot → DB
- Бот пишет в PostgreSQL вместо Google Sheets (замена одного модуля)
- Миграция 16K записей из CSV/Sheets

#### Phase 2.4: TeamWork Read Integration
- `integrations/teamwork.py` — REST API v3 client
- Поиск тикетов: `GET /projects/{id}/tasks.json?searchTerm=...`
- Matcher: `confirmed_issue → ticket (found / not found / resolved)`
- UI: статус тикета рядом с каждым confirmed issue

#### Phase 2.5: LLM Response Cache
- Хеш промпта → кешированный ответ (PostgreSQL или Redis)
- TTL-настраиваемый

---

### 🏁 Milestone 3: Push Alerts + Anomaly Detection (Фаза 3 Vision)

**Цель:** Переход от pull к push — система сама уведомляет команду.

**Бюджет:** 5–7 дней

#### Phase 3.1: Anomaly Detector (Enhanced)
- Рефактор текущего [alerts.py](file:///Users/eli/Documents/PythonProjects/gamedev%20tools/review-parser/alerts.py) → real-time mode
- Статистический spike detection по тегам (moving baseline)
- Порог настраиваемый через dashboard config

#### Phase 3.2: Alert Delivery
- Telegram Bot API: отправка алертов в канал команды
- Email (SMTP): weekly pulse + critical alerts
- Alert routing: CM → TG, PO → Dashboard + Email, DevOps → TG (infra only)

#### Phase 3.3: TeamWork Auto-Create
- Расширение `integrations/teamwork.py` → `POST /projects/{id}/tasks.json`
- Confirmed issue без тикета → автоматический тикет
- UI: кнопка "[Создать тикет]" для ручного override

#### Phase 3.4: Basic Infra Monitoring
- `monitors/healthcheck.py` — HTTP ping по списку endpoints
- Timeline инфраструктурных событий в DB
- UI: timeline инцидентов на dashboard

---

### 🏁 Milestone 4: Infra Correlation (Фаза 4 Vision)

**Бюджет:** 7–14 дней

- Grafana API интеграция (метрики: latency, error rate, online players)
- Внешние проверки доступности (multi-region)
- LLM-корреляция: timeline жалоб × timeline инфра-событий
- Гео-анализ (регион по языку/юзернейму/часовому поясу)
- «Resolved but still complaining» детекция
- Дашборд: карта инцидентов с регионами

---

### 🏁 Milestone 5: SaaS Preparation (Фаза 5 Vision)

**Бюджет:** По потребности

- Мультитенантность (изоляция данных)
- Конфигурируемые теги классификации
- Поддержка Jira / YouTrack / Linear
- Onboarding flow
- Дополнительные источники (Yandex, VK Play, Discord)
- Биллинг

---

## Рекомендуемый порядок старта

> [!IMPORTANT]
> **Рекомендация: начать с Milestone 1** — он доказывает ключевую гипотезу (кросс-анализ даёт инсайты, которых нет по отдельности) за 2–3 дня, используя максимум существующего кода.

**Критический путь Phase 1:**
```
Apple collector (1.1) ──┐
                        ├──→ Cross-analysis prompt (1.3) → Pipeline integration (1.4) → UI (1.5)
TG bridge (1.2) ────────┘
```

Phase 1.1 и 1.2 можно вести параллельно. Phase 1.3 зависит от обоих. Phase 1.4–1.5 последовательно.

---

## Verification Plan

Это документ-роадмап, не код. Верификация:
- Ревью стейкхолдерами (автор + Василий + Паша Костин)
- Сопоставление каждого milestone с фазами Vision v1 (покрытие 100%)
- Валидация технических зависимостей (community/ module → TG bridge, alerts.py → anomaly detector)

---

*Дата: 01 Марта 2026 | На основе GamePulse Product Vision v1.0*
