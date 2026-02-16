0) Важные ограничения, чтобы ожидания совпали с реальностью

Google Play / App Store “чужие” отзывы
Для своих приложений есть официальные API с богатыми метаданными (включая девайсы/OS), но для конкурентных приложений обычно приходится идти через публичные фиды/скрейпинг.

Google Play Developer API для отзывов действительно содержит device / androidOsVersion / appVersionName / deviceMetadata — но это про доступ разработчика к своим приложениям.

У Apple в App Store Connect API можно получить customer reviews для своего приложения и фильтровать/сортировать.

Скрейпинг может конфликтовать с Terms
У Google в общих Terms есть запрет на злоупотребления, включая автоматизированный доступ к контенту в нарушение машиночитаемых инструкций (например, robots.txt).
Поэтому в PoC держи малый объём запросов, кэширование, паузы, и будь готов, что источники могут ломаться.

“Корреляция с девайсами” для конкурентов почти всегда слабая

В Google Play при публичном сборе отзывов обычно есть версия приложения (и дата), но девайсы — не гарантированы.

В Apple публичный RSS/Atom обычно не даёт device; зато часто есть версия приложения.
В MVP можно честно сделать:

корреляцию по версии приложения / времени / рейтингу / стране/языку,

а “device” — либо “Android vs iOS”, либо инференс девайса из текста (regex по “iPhone 13”, “Samsung A52” и т.п.) как best-effort.

1) MVP за 1 день: что именно построить (чтобы показать Василию “actionable insights”)
Цель отчёта (1–2 страницы HTML/Markdown)

“Что болит у игроков и после каких версий”:

Топ-5 негативных тем (кластеров) + примеры цитат

Топ-3 позитивных темы

Какие темы “выросли” за последние 6 месяцев (тренд по неделям/месяцам)

Связь тем с версиями: “после версии X.Y резко выросли жалобы на …”

Рекомендации действий: “исправить/проверить/добавить метрику/AB”

Последние 6 месяцев от сегодня (6 фев 2026) — это примерно с 6 авг 2025.

2) Архитектура простого MVP (минимум компонентов)
Компоненты

Collectors (источники)

google_play: забираем отзывы по package name
Вариант для PoC: библиотека google-play-scraper (Python) умеет вытаскивать отзывы и содержит поля вроде content, score, thumbsUpCount, reviewCreatedVersion, at, appVersion.

app_store: публичный RSS для отзывов
Вариант для PoC: app-store-reviews-reader (Python) читает RSS и возвращает review с version, rating, id, title, content, date, country, и т.д.
(Имей в виду: публичные RSS-эндпоинты Apple иногда “падают/возвращаются”. )

Normalizer (унификация схемы)
Приводим всё к единой структуре:

store, app_key, review_id, date, rating, title, text,
app_version, country, language,
thumbs_up, author (опционально/обезличено),
raw_json


Storage

Для 1 дня: DuckDB (или SQLite) + parquet/jsonl кэш сырья.

Почему DuckDB: легко агрегировать, быстро, один файл, удобно для отчёта.

NLP/ML слой

Очистка текста (минимально)

Векторизация:

быстрый и стабильный вариант: TF‑IDF + KMeans (работает без тяжёлых зависимостей)

более “умный” вариант: sentence-transformers (multilingual) embeddings + HDBSCAN/BERTopic

Лейблинг тем:

без LLM: top-n keywords по теме

с LLM: краткое название темы + “что сделать”

Correlation слой

topic x app_version: доля/кол-во отзывов по теме на версию

topic x time: тренды

topic x rating: “тема в основном 1–2 звезды или 4–5”

(опционально) “device inferred”: regex-детектор по тексту

Report генератор

Markdown → HTML (Jinja2-шаблон) + графики (matplotlib)

Артефакт: report.html + report.md + charts/*.png

3) Рекомендуемый стек (быстро, прагматично)
Язык / рантайм

Python 3.11+

Основные библиотеки

Сбор:

Google Play: google-play-scraper

Apple RSS: app-store-reviews-reader

Данные: pandas, duckdb, pyarrow

NLP:

Быстрый baseline: scikit-learn (TF‑IDF + KMeans)

Улучшенный: sentence-transformers, bertopic (если успеешь/встанет без боли)

Отчёт: jinja2, markdown/markdown-it-py, matplotlib

CLI / упаковка

typer (CLI)

uv или poetry (зависимости)

ruff (линт/формат)

4) План “сделать за 1 день” (реально выполнимый)
2–3 часа: сбор + кэш

Сделать CLI fetch

Скачивать, например, до 2000–5000 отзывов (не “все-все”)

Фильтровать по дате (>= 6 месяцев назад)

Кэшировать в data/raw/*.jsonl и в таблицу DuckDB

2–3 часа: темы (кластеризация)

TF‑IDF + KMeans на 10–20 кластеров

Для каждого кластера:

top keywords

топ-цитаты (3–5)

средняя оценка

1–2 часа: корреляции

Тренд по времени (недели/месяцы)

Разрез по app_version (если есть в источнике)

Негативные темы: rank по количеству 1–2★

1–2 часа: отчёт

HTML (или Markdown) с:

Summary (сколько отзывов, период)

Таблица тем (name, share, avg rating)

2–3 графика

“Action items” (ручные или LLM-генерённые)

5) Готовый промпт для Claude Code Opus 4.5 (копируй-вставляй)

Ниже промпт так написан, чтобы Claude создал репозиторий целиком: CLI, сбор, анализ, отчёт, README.
(Если у тебя есть предпочтения по менеджеру зависимостей — поменяй uv на poetry в промпте, но я бы оставил uv ради скорости.)

Ты — Claude Code Opus 4.5. Сгенерируй полностью рабочий Python-проект “review_analytics_mvp” (Python 3.11+), который делает PoC-пайплайн:

парсинг отзывов (Google Play + Apple App Store RSS) → кластеризация по темам → корреляции с версиями/временем/рейтингом → генерация HTML-отчёта.

ОГРАНИЧЕНИЯ И ЦЕЛИ:
- Это MVP за 1 день: простота и стабильность важнее идеальности.
- По умолчанию работаем без LLM. Но добавь опциональный режим `--llm` (через переменную окружения), который делает короткое название темы и рекомендации. Если ключа нет — просто пропускаем LLM.
- Данные кэшируем локально, чтобы не дёргать сторы повторно.
- Не делай агрессивный скрейпинг: добавь sleep и лимиты.
- В отчёте обязательно: топ негативных тем, тренд тем во времени, связь тем с версиями (если версии доступны), примеры цитат.

ИСТОЧНИКИ:
1) Google Play: используй библиотеку `google-play-scraper` (pip package `google-play-scraper`, import `google_play_scraper`).
   Нужна функция:
   `fetch_google_play_reviews(package_name, since_date, lang, country, max_reviews) -> list[dict]`
   Используй sort=NEWEST и пагинацию через continuation_token. Сохраняй поля: review_id (если есть), at/date, score, content, thumbsUpCount, reviewCreatedVersion/appVersion.
2) Apple App Store: используй библиотеку `app-store-reviews-reader` (pip package `app-store-reviews-reader`).
   Нужна функция:
   `fetch_app_store_reviews(app_id, country, since_date, max_reviews) -> list[dict]`
   Сохраняй поля: id, date, rating, title, content, version, author_name (но в отчёте не показывать автора — только текст).

СХЕМА (унифицированная модель Review):
- store: "google_play" | "app_store"
- app_key: строка (package_name или app_id)
- review_id: строка
- date: ISO8601
- rating: int 1..5
- title: str (может быть пустым)
- text: str
- app_version: str | null
- country: str | null
- language: str | null
- thumbs_up: int | null
- raw_json: json

ХРАНЕНИЕ:
- Используй DuckDB (файл `data/reviews.duckdb`)
- Таблица `reviews` (колонки как выше)
- При повторном запуске: не дублируй отзывы (dedupe по store+app_key+review_id).

АНАЛИТИКА:
- Реализуй baseline кластеризацию:
  - TF-IDF (min_df=3, max_df=0.9, ngram_range=(1,2))
  - KMeans с k по умолчанию 15, настраивается флагом `--k`.
- Для каждого кластера вычисли:
  - share (доля)
  - count
  - avg_rating
  - top_keywords (10)
  - 5 representative quotes (самые близкие к центроиду или самые длинные/информативные)
- Корреляции:
  - Trend по времени: агрегация по неделям (ISO week) и кластерам
  - Версии: если app_version заполнен — топ кластеров по каждой версии и "скачки" (сравнить последнюю версию vs предыдущую по доле негативных отзывов)
  - Негатив: считать негативом rating<=2

ОТЧЁТ:
- Сгенерируй `reports/report.html` + `reports/report.md`
- В HTML используй Jinja2 + встроенные графики (matplotlib сохраняй png в `reports/charts/`).
- Структура отчёта:
  1) Dataset summary (период, кол-во отзывов, распределение рейтингов)
  2) Top negative themes (таблица + цитаты)
  3) Topic trends (график топ-5 тем по времени)
  4) Version correlation (если есть версии)
  5) Appendix: все темы (таблица)

CLI:
Сделай CLI на Typer с командами:
- `fetch` (параметры: --store, --package-name, --app-id, --country, --lang, --since-days, --max-reviews)
- `analyze` (параметры: --k)
- `report` (строит отчёт из результатов)
- `run` (fetch -> analyze -> report одним вызовом)

ПРОЕКТНАЯ СТРУКТУРА (пример):
review_analytics_mvp/
  pyproject.toml
  review-parser/README.md
  review_analytics/
    __init__.py
    cli.py
    config.py
    storage.py
    models.py
    collectors/
      google_play.py
      app_store.py
    analysis/
      preprocess.py
      clustering.py
      metrics.py
    reporting/
      report.py
      templates/report.html.j2
  data/ (создаётся автоматически)
  reports/ (создаётся автоматически)
  tests/
    test_dedupe.py
    test_preprocess.py

README (`review-parser/README.md`):
- Как установить (uv venv + pip)
- Примеры команд:
  - `python -m review_analytics run --store google_play --package-name com.example.app --country us --lang en --since-days 180 --max-reviews 2000`
  - `python -m review_analytics run --store app_store --app-id 497799835 --country us --since-days 180 --max-reviews 1000`
- Где лежит отчёт: `reports/report.html`

КАЧЕСТВО:
- Добавь type hints, базовую обработку ошибок сети, retries (не агрессивно), логирование.
- Линт/формат: ruff (минимальная конфигурация).
- В тестах не ходим в сеть: тестируем dedupe и TF-IDF pipeline на синтетике.

СГЕНЕРИРУЙ ВЕСЬ КОД ФАЙЛОВ ПРОЕКТА (содержимое каждого файла).

6) Что я бы “подсветил” Василию в демо (чтобы было политически полезно)

Сильная сторона PoC: быстро показывает “карта болей” + “в каких версиях вспыхнуло”.

Честные ограничения: device-level корреляции часто недоступны публично; для настоящей продуктовой аналитики нужен доступ к first-party данным (devtodev/внутренние логи) и/или официальные API для своих приложений.

Следующий шаг (если зайдёт): подключить devtodev (события/краши/сессии) и проверять гипотезы из отзывов на реальных метриках.
