# Refactoring Plan: review-parser → GamePulse Preparation

**Date:** 2026-03-01
**Status:** In progress

## Context

Кодовая база review-parser (~5000 LOC Python, ~3000 LOC TypeScript) эволюционирует в GamePulse — кросс-аналитическую платформу для игровых студий. Рефакторинг преследует три цели:

1. **Code-quality** — разбить функции >50 строк, убрать дублирование (4x batch-паттерн, 4x safe_name, date parsing), вынести magic numbers
2. **Подготовка к GamePulse Phase 1** — UnifiedFeedbackItem, sources/ модуль, community/ пакет
3. **Переход на OpenRouter + per-task модели** — абстрагировать LLM-клиент от Anthropic, задать разные модели для разных pipeline-задач (дешёвые для classification, мощные для synthesis)

**Решения пользователя:**
- Lead-finder: НЕ ТРОГАТЬ (уйдёт в другой проект)
- Community classifier: вынести в отдельный модуль, не интегрировать в pipeline
- API contract: оставить маппинг категорий, задокументировать явно
- Сохранённые артефакты: не ломать

---

## Step 1: Абстракция LLM-клиента (`llm.py`)

**Файлы:** новый `llm.py`, модификация `utils.py`, `requirements.txt`

### Модели по задачам

| Задача | Модель (дефолт) | Env var override |
|--------|----------------|-----------------|
| Classification | `google/gemini-2.5-flash-lite` | `MODEL_CLASSIFY` |
| Noise gate | `google/gemini-2.5-flash-lite` | `MODEL_NOISE_GATE` |
| Translation | `google/gemini-2.5-flash-lite` | `MODEL_TRANSLATION` |
| Community classify | `google/gemini-2.5-flash-lite` | `MODEL_COMMUNITY` |
| Theme extraction | `google/gemini-3-flash-preview` | `MODEL_THEMES` |
| Synthesis/Summary | `google/gemini-3.1-pro-preview` | `MODEL_SYNTHESIS` |
| Default | `google/gemini-3-flash-preview` | `LLM_MODEL` |

**Env vars (`.env`):**
```
LLM_API_KEY=sk-or-v1-...
LLM_BASE_URL=https://openrouter.ai/api/v1
# Per-task model overrides (optional):
# MODEL_THEMES=google/gemini-3-flash-preview
# MODEL_CLASSIFY=google/gemini-2.5-flash-lite
# MODEL_SYNTHESIS=google/gemini-3.1-pro-preview
# Fallback на stable если preview нестабильны:
# MODEL_THEMES=google/gemini-2.5-flash
# MODEL_SYNTHESIS=google/gemini-2.5-pro
```

**Оценка стоимости на 200 отзывов:**
- Текущий стек (всё через Claude Sonnet $3/$15): ~$0.50–$1.00 за прогон
- Оптимизированный (тиражные модели): ~$0.05–$0.10 за прогон
- **Экономия: ~8-12x**

---

## Step 2: Централизация конфигурации (`config.py`)

**Файлы:** новый `config.py`, модификация потребителей

```python
# Batch sizes
THEME_BATCH_SIZE = 50
CLASSIFY_BATCH_SIZE = 30
NOISE_GATE_BATCH_SIZE = 40
COMMUNITY_CLASSIFY_BATCH_SIZE = 30
TRANSLATION_BATCH_SIZE = 25

# Concurrency
DEFAULT_MAX_CONCURRENCY = 4
SHARED_PIPELINE_CONCURRENCY = 6

# Alerts
SPIKE_MULTIPLIER = 2.0
SPIKE_WINDOW_HOURS = 48
CRITICAL_SUBCATEGORIES = frozenset({"crash", "progression_loss", "login_auth"})

# Scraper
SCRAPER_PAGE_DELAY = 2
SCRAPER_CACHE_TTL_HOURS = 24

# Community
THREAD_GAP_SECONDS = 300
THREAD_CONTEXT_WINDOW = 5
```

---

## Step 3: Консолидация утилит в `utils.py`

- `safe_name()` — единая функция (было 4 копии)
- `escape_table_cell()`, `format_rating()` — перенести из analyzer.py и report_builder.py
- `parse_date()` — расширить до `Any` input
- Удалить `get_client_and_model()` и `call_model()` (переехали в `llm.py`)

---

## Step 4: Generic batch processor в `utils.py`

```python
async def run_batched(
    items: list[T],
    batch_size: int,
    processor: Callable[[list[T]], Awaitable[list[R]]],
    semaphore: asyncio.Semaphore,
    progress_callback = None,
) -> list[R]:
```

Потребители (`run_theme_extraction`, `run_classification`) сокращаются до 5-7 строк.

---

## Step 5: Разбить `_generate_dashboard()` в `server.py`

308 строк → 4 функции:
- `_resolve_dashboard_params()` — нормализация параметров
- `_fetch_all_reviews()` — мультистрановый fetch + merge + window filter
- `_run_pipeline_and_build_report()` — pipeline + report
- `_save_and_log_result()` — артефакт, логирование, return

---

## Step 6: Разбить `merge_themes()` в `analyzer.py`

76 строк → 3 функции:
- `_accumulate_themes()` — группировка и слияние
- `_consolidate_themes()` — финальный sentiment, severity, сортировка
- `merge_themes()` — оркестратор

---

## Step 7: `UnifiedFeedbackItem` модель (`models.py`)

```python
@dataclass
class UnifiedFeedbackItem:
    item_id: str
    text: str
    source: str = "google_play"
    rating: int | None = None
    date: str = ""
    version: str | None = None
    lang: str = "en"

    def to_legacy_dict(self) -> dict: ...
    @classmethod
    def from_legacy_dict(cls, d: dict, source="google_play"): ...
```

НЕ переводить pipeline на UnifiedFeedbackItem сейчас — только мост.

---

## Step 8: `sources/` модуль

```python
class GooglePlaySource:
    source_name = "google_play"
    def collect(self) -> tuple[list[UnifiedFeedbackItem], dict]: ...
```

Тонкий адаптер поверх `scraper.py`.

---

## Step 9: Community classifier → `community/` пакет

- `community/loader.py` — `load_community_csv()`
- `community/threads.py` — группировка в треды, `_parse_ts()`
- `community/classifiers.py` — noise gate + topic classify (параметризация топиков)
- `community/pipeline.py` — `run_community_pipeline()` + CLI
- `community_classifier.py` → backward-compatible re-export

---

## Step 10: Документация маппинга категорий (frontend)

- JSDoc на `categoryFromApi()` с полной таблицей маппинга
- `source?: string` поле в `ApiReview` и `RunArtifact`

### Маппинг:
| API value | Frontend category | Смысл |
|-----------|------------------|-------|
| `new_bug` | `bug` | Новый баг, не зафиксированный ранее |
| `known_issue` | `complaint` | Известная проблема / жалоба |
| `feature_request` | `feature` | Запрос фичи |
| `praise` | `praise` | Положительный отзыв |
| `noise` | `noise` | Нерелевантный контент |
| *(unknown)* | `complaint` | Fallback |

---

## Step 11: `feedback_source` в артефактах

Добавить `feedback_source: "google_play"` в сохраняемые артефакты.
Backward-compatible (старые артефакты не имеют поля).

---

## Порядок выполнения

```
Group A (фундамент, нет зависимостей):
  Step 1: llm.py
  Step 2: config.py
  Step 7: models.py
  Step 10: frontend docs

Group B (зависят от A):
  Step 3: utils.py cleanup
  Step 4: run_batched()
  Step 6: merge_themes split

Group C (зависят от B):
  Step 5: split _generate_dashboard
  Step 8: sources/ модуль
  Step 9: community/ пакет
  Step 11: feedback_source
```

## Файлы НЕ трогаем

- `lead-finder/` — целиком
- `lead_scan.py`
- `prompts/*.txt`
- `data/runs/*.json`
- `observability.py`

## Verification

1. `python main.py "com.example.app" --max-reviews 50` — работает
2. `python server.py` + report через frontend — работает
3. `python community_classifier.py` — работает (через re-export)
4. Загрузка старых артефактов через `/api/runs/{id}` — работает
5. Frontend dashboard рендерится, маппинг категорий работает
