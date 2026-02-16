# Review Analytics MVP v2 — Архитектура "Lean PoC за 1 день"

## Философия: LLM-first, Demo-driven

Коллега предложил классический ML-pipeline (TF-IDF → KMeans → matplotlib).
Мой подход: **LLM делает тяжёлую работу по пониманию, код — только сбор и визуализацию.**

Почему:
- TF-IDF + KMeans даёт "кластер 7: crash, bug, fix, update, app" → Василий скажет "и что?"
- Claude API даёт: "Критический баг: краш при загрузке уровня после обновления 2.3.1, затрагивает преимущественно Samsung Galaxy A-серию" → Василий скажет "вот это полезно"
- Для PoC качество инсайтов важнее масштабируемости пайплайна

---

## Архитектура (4 компонента, ~500 строк кода)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Collectors  │────▶│  Cache/DB   │────▶│  LLM Analyzer│────▶│  Dashboard  │
│  (GP + AS)   │     │  (SQLite)   │     │  (Claude API)│     │ (Streamlit) │
└─────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

### Компонент 1: Collectors (~100 строк)
- Google Play: `google-play-scraper` — проверенная, стабильная
- App Store: `app_store_scraper` (pip: `app-store-scraper`) — надёжнее чем RSS
- Унификация в единую модель Review (dataclass)
- Rate limiting: 1-2 сек пауза между батчами

### Компонент 2: Cache/Storage (~50 строк)
- **SQLite** (не DuckDB) — проще, zero-config, хватает для <50K отзывов
- Dedupe по (store, app_key, review_id)
- Export в pandas DataFrame одной строкой

### Компонент 3: LLM Analyzer (~150 строк)
Ключевое отличие от решения коллеги.

**Стратегия обработки (batch + summarize):**

```
Шаг 1: Группируем отзывы в батчи по ~50 штук
Шаг 2: Каждый батч → Claude API → JSON с темами + тональностью
Шаг 3: Агрегируем темы из всех батчей → финальный merge
Шаг 4: Финальный промпт → сводный отчёт с рекомендациями
```

**Промпт для батч-анализа** (внутри пайплайна):
```
Проанализируй эти отзывы на мобильную игру.
Для каждого отзыва определи:
- topic: краткое название темы (5-7 слов)
- sentiment: positive / negative / neutral
- severity: 1-5 (насколько критично для бизнеса)
- mentions_version: true/false
- device_mentioned: название устройства если упоминается, иначе null

Затем сгруппируй по темам и дай:
- Название темы
- Количество упоминаний
- Средний рейтинг
- Топ-3 цитаты (самые информативные)
- Бизнес-импакт (1 предложение)

Ответь строго в JSON.
```

**Почему это лучше TF-IDF:**
- Понимает контекст ("game crashes after watching ad" → тема "Краш после рекламы", а не кластер "crash+ad+watch")
- Работает мультиязычно из коробки (русские + английские отзывы)
- Извлекает device mentions, версии, severity — всё сразу
- Стоимость: ~2000 отзывов ≈ $1-3 через Claude Sonnet

### Компонент 4: Dashboard (~200 строк)
**Streamlit** вместо статичного HTML:
- Интерактивный фильтр по рейтингу, теме, дате, версии
- Plotly-графики (zoom, hover)
- Таблица тем с drill-down в конкретные отзывы
- LLM-сгенерированный Executive Summary вверху

**Альтернатива** (если Streamlit кажется overkill): один HTML-файл с Plotly.js + встроенные данные.

---

## Стек

| Компонент | Библиотека | Зачем именно эта |
|-----------|-----------|-----------------|
| Сбор GP | `google-play-scraper` | Стабильная, 4K+ stars |
| Сбор AS | `app_store_scraper` | Надёжнее RSS |
| Хранение | `sqlite3` (stdlib) | Zero-config, встроен в Python |
| Данные | `pandas` | Агрегации, группировки |
| LLM | `anthropic` SDK | Claude Sonnet 4.5 — быстрый, дешёвый, точный |
| Визуализация | `plotly` | Интерактивные графики |
| Дашборд | `streamlit` | Демо за 30 минут |
| CLI | `argparse` (stdlib) | Для PoC хватит, не тащим Typer |

**Менеджер:** `uv` (быстрее pip в 10-100x)

---

## План на 1 день (8 часов)

| Время | Задача | Результат |
|-------|--------|-----------|
| 0:00–1:30 | Collectors + Cache | Отзывы в SQLite |
| 1:30–2:30 | Проверка данных, EDA | Понимаем что получили |
| 2:30–4:30 | LLM Analyzer | JSON с темами |
| 4:30–6:00 | Dashboard/Report | Streamlit или HTML |
| 6:00–7:00 | Полировка, тест на реальных данных | Готовый PoC |
| 7:00–8:00 | update `review-parser/README.md` + запуск-демо | Можно показывать |

---

## Структура проекта (lean — 6 файлов)

```
review_analytics/
├── pyproject.toml
├── (see `review-parser/README.md`)
├── fetch.py          # Collectors + cache (SQLite)
├── analyze.py        # LLM batch analysis
├── report.py         # Generate HTML report (standalone, no Streamlit)
├── dashboard.py      # Streamlit dashboard (optional, for live demo)
├── config.py         # Settings, API keys
├── data/             # auto-created
│   └── reviews.db
└── reports/          # auto-created
    └── report.html
```

**6 файлов vs 15+ у коллеги.** Каждый файл — самостоятельный, можно запустить отдельно.

---

## Промпт для Claude Code (итеративный подход)

Вместо одного монолитного промпта — **серия из 4 промптов**, каждый создаёт один слой.
Claude Code работает лучше, когда задача конкретная и тестируемая.

### Промпт 1/4: Проект + Collectors + Cache

```
Создай Python-проект review_analytics (Python 3.11+, менеджер uv).

pyproject.toml с зависимостями:
- google-play-scraper
- app-store-scraper
- pandas
- anthropic
- plotly
- streamlit
- jinja2

Создай файл config.py:
- DATA_DIR = Path("data"), создаётся автоматически
- REPORTS_DIR = Path("reports"), создаётся автоматически
- DB_PATH = DATA_DIR / "reviews.db"
- ANTHROPIC_API_KEY из переменной окружения
- DEFAULT_SINCE_DAYS = 180
- FETCH_DELAY = 1.5  # секунды между батчами

Создай файл fetch.py:
- dataclass Review: store, app_key, review_id, date (datetime), rating (int), title (str),
  text (str), app_version (str|None), country (str|None), thumbs_up (int|None)
- Функция init_db() — создаёт SQLite таблицу reviews если не существует, с UNIQUE(store, app_key, review_id)
- Функция fetch_google_play(package_name: str, country: str = "us", lang: str = "en",
  since_days: int = 180, max_reviews: int = 3000) -> list[Review]:
  Использует google_play_scraper.reviews с sort=Sort.NEWEST, пагинация через continuation_token.
  Sleep FETCH_DELAY между батчами. Фильтрует по дате (>= today - since_days).
  Маппинг полей: content→text, score→rating, at→date, reviewCreatedVersion→app_version.
- Функция fetch_app_store(app_id: str, country: str = "us",
  since_days: int = 180, max_reviews: int = 1000) -> list[Review]:
  Использует app_store_scraper.AppStore. Маппинг: review→text, rating→rating, date→date, title→title.
  Обрати внимание: app_store_scraper может не иметь app_version для каждого отзыва — ставь None.
- Функция save_reviews(reviews: list[Review]) — INSERT OR IGNORE в SQLite.
- Функция load_reviews(app_key: str = None) -> pd.DataFrame — загрузка из SQLite в pandas.
- CLI через argparse:
  python fetch.py --store google_play --app-key com.herocraft.game --country us --lang en --since-days 180 --max-reviews 3000
  python fetch.py --store app_store --app-key 123456789 --country us --since-days 180 --max-reviews 1000

Добавь логирование (logging, уровень INFO), обработку сетевых ошибок (retry 3 раза с exponential backoff).
Протестируй: после запуска `python fetch.py --store google_play --app-key com.google.android.apps.maps --max-reviews 100`
должна появиться база data/reviews.db с отзывами.
```

### Промпт 2/4: LLM Analyzer

```
В проекте review_analytics создай файл analyze.py.

Этот модуль берёт отзывы из SQLite (через fetch.load_reviews) и анализирует их через Claude API (anthropic SDK).

Логика:
1. Загружаем отзывы в DataFrame
2. Разбиваем на батчи по 50 отзывов (настраивается)
3. Каждый батч отправляем в Claude Sonnet (модель claude-sonnet-4-5-20250929) с промптом:

---BEGIN ANALYSIS PROMPT---
You are analyzing mobile game reviews. For this batch of reviews, do the following:

1. For each review, classify:
   - topic_id: a short snake_case identifier for the topic (e.g., "crash_after_update", "too_many_ads", "great_gameplay")
   - topic_label: human-readable topic name in Russian (e.g., "Краш после обновления")
   - sentiment: "positive", "negative", or "neutral"
   - severity: 1-5 (5 = critical business impact)
   - device_mentioned: device name if mentioned in text, else null
   - version_mentioned: app version if mentioned in text, else null

2. Return a JSON object:
{
  "classified_reviews": [
    {
      "review_id": "...",
      "topic_id": "...",
      "topic_label": "...",
      "sentiment": "...",
      "severity": ...,
      "device_mentioned": ...,
      "version_mentioned": ...
    }
  ],
  "topics_summary": [
    {
      "topic_id": "...",
      "topic_label": "...",
      "count": ...,
      "avg_rating": ...,
      "severity": ...,
      "representative_quotes": ["...", "...", "..."],
      "business_impact": "одно предложение о влиянии на бизнес"
    }
  ]
}

Return ONLY valid JSON, no markdown fences.
---END ANALYSIS PROMPT---

Формат отзывов в промпте:
```
Review ID: {review_id} | Rating: {rating}★ | Date: {date} | Version: {app_version or 'N/A'}
{text[:500]}
```

4. Собираем результаты из всех батчей:
   - classified_reviews → DataFrame с колонками review_id, topic_id, topic_label, sentiment, severity, device_mentioned, version_mentioned
   - Мержим с исходным DataFrame по review_id
   - Агрегируем topics: группируем по topic_id, считаем count, avg_rating, severity
   - Дедуплицируем похожие темы (если topic_label отличается незначительно — берём самый частый вариант)

5. Генерируем Executive Summary (отдельный вызов Claude):
   Промпт: "На основе анализа {N} отзывов за последние {M} месяцев, вот топ-темы: {topics_json}.
   Напиши Executive Summary на русском языке для руководства игровой студии:
   - 3 главных проблемы и что с ними делать
   - 2 главных позитива (что не трогать)
   - 1 неочевидный инсайт
   Формат: 1 абзац на каждый пункт, конкретно и actionable."

6. Сохраняем результаты:
   - data/analysis_results.json (все темы + classified reviews)
   - data/executive_summary.txt

CLI:
python analyze.py --app-key com.herocraft.game --batch-size 50

Обработка ошибок: если Claude API вернул не-JSON, retry с пометкой "Return ONLY valid JSON". Макс 3 retry на батч.
Логирование: прогресс (batch 1/20, 2/20, ...), стоимость (считай input/output tokens).
```

### Промпт 3/4: HTML Report

```
В проекте review_analytics создай файл report.py.

Этот модуль читает data/analysis_results.json и data/executive_summary.txt,
и генерирует красивый standalone HTML отчёт reports/report.html.

Требования к отчёту:
- Один HTML файл, все стили inline, графики через Plotly.js (CDN).
- Адаптивный, хорошо смотрится на экране ноутбука.
- Тёмная тема (dark background, light text) — выглядит "технологично".

Структура отчёта:

1. HEADER:
   - Название: "Review Analytics Report: {app_name}"
   - Период: {start_date} — {end_date}
   - Всего отзывов: {N}, средний рейтинг: {avg}

2. EXECUTIVE SUMMARY:
   - Текст из executive_summary.txt, оформленный как карточки

3. RATING DISTRIBUTION:
   - Горизонтальная bar chart (1★..5★) с Plotly

4. TOP NEGATIVE THEMES (severity >= 3, sentiment == negative):
   - Таблица: тема, кол-во, avg rating, severity, бизнес-импакт
   - Для каждой темы — раскрываемый блок с цитатами (HTML details/summary)

5. TOP POSITIVE THEMES:
   - Аналогичная таблица, но для позитивных

6. TOPIC TRENDS OVER TIME:
   - Line chart (Plotly): топ-5 тем по неделям
   - X: неделя, Y: кол-во отзывов по теме

7. VERSION ANALYSIS (если есть данные по версиям):
   - Stacked bar chart: версия → распределение тем
   - Highlight: "После версии X выросли жалобы на Y"

8. APPENDIX: ALL TOPICS:
   - Полная таблица всех тем с сортировкой

CLI:
python report.py --input data/analysis_results.json --output reports/report.html

Используй Jinja2 для шаблонизации. Plotly графики генерируй через plotly.io.to_html(full_html=False).
Отчёт должен открываться в браузере без сервера (просто file:// протокол).
```

### Промпт 4/4: Streamlit Dashboard (опционально)

```
В проекте review_analytics создай файл dashboard.py — Streamlit-дашборд.

Запуск: streamlit run dashboard.py

Дашборд читает data/analysis_results.json и data/reviews.db.

Layout:
- Sidebar:
  - Фильтр по рейтингу (multiselect 1-5)
  - Фильтр по sentiment (positive/negative/neutral)
  - Фильтр по дате (date range slider)
  - Фильтр по теме (multiselect)
  - Фильтр по версии (если есть)

- Main area:
  - Метрики вверху: всего отзывов, avg rating, % negative, топ-проблема
  - Executive Summary (expandable)
  - 2 колонки:
    - Left: Topic distribution (Plotly pie/treemap)
    - Right: Rating distribution (Plotly bar)
  - Topic trends over time (Plotly line chart)
  - Таблица отзывов с фильтрацией (st.dataframe с поиском)

Стиль: используй st.set_page_config(layout="wide"), минимальный кастомный CSS.
```

---

## Ключевые отличия от решения коллеги

| Аспект | Решение коллеги | Моё решение |
|--------|----------------|-------------|
| Кластеризация | TF-IDF + KMeans | Claude API (LLM-first) |
| Качество тем | Набор ключевых слов | Человекочитаемые названия + action items |
| Мультиязычность | Нужна доп. настройка | Из коробки (Claude понимает все языки) |
| Структура | 15+ файлов, CLI на Typer | 6 файлов, argparse |
| Визуализация | matplotlib PNG | Plotly (интерактивный) |
| Демо формат | Статичный HTML | Streamlit dashboard + HTML fallback |
| Стоимость | $0 (но низкое качество) | $2-5 на Claude API (но wow-эффект) |
| Промпт для CC | 1 монолитный | 4 итеративных (надёжнее) |
| Device extraction | Regex (ненадёжно) | LLM извлекает из контекста |
| Executive Summary | Нет | Есть, LLM-генерированный |
| Fallback без LLM | Основной режим | Можно добавить TF-IDF как fallback |

---

## Советы по демо Василию

1. **Открой дашборд на его ноутбуке** (streamlit share или просто запусти локально)
2. **Начни с Executive Summary** — "вот 3 главные проблемы, вот что делать"
3. **Покажи drill-down** — клик на тему → конкретные отзывы
4. **Покажи тренды** — "после версии 2.3 жалобы на краши выросли в 3 раза"
5. **Заверши вопросом**: "Хотите добавить данные devtodev для корреляции с retention?"

Это естественный мост к "более глубокой аналитике" — именно то, что ты хочешь.
