# Plan: Модернизация Review Parser — Update-Aware Alert Pipeline

## Context

Текущий Review Parser собирает отзывы и извлекает общие темы, но **не привязывает отзывы к обновлениям**, не классифицирует тип фидбека (баг/фича-реквест/шум) и не генерирует alert-отчёты. Цель — превратить review parser из инструмента "общего анализа" в **pipeline мониторинга обновлений**, который автоматически обнаруживает проблемы после релизов.

### Что уже есть и можно переиспользовать
- `scraper.py` — сбор отзывов с пагинацией, кэшированием, retry (отзывы уже содержат поле `version`)
- `analyzer.py` — батч-обработка через Claude, мерж тем, генерация отчёта
- `prompts/` — шаблоны промптов (отделены от кода)
- `google-play-scraper` `app()` возвращает `version`, `lastUpdatedOn`, `recentChanges` (changelog!) — **сейчас не используется**
- Отзывы уже содержат `version` — **сейчас не используется при анализе**
- Docker + entrypoint для CLI-запуска

### Исследование best practices (Exa, 10.02.2026)
- **LLM zero-shot классификация** app reviews достигает F1 ~0.85 для категорий bug/feature/experience/noise (SciTePress 2025, arXiv 2025)
- **Промпт-инжиниринг**: лучшие результаты при чётком описании категорий + примерах + контексте (changelog)
- **Anomaly detection**: для объёмов мобильных отзывов достаточно простой статистики (сравнение с baseline), без ML-моделей
- **Device info**: Google Play API не предоставляет устройство, но пользователи часто упоминают модели в тексте — LLM может извлечь

---

## Архитектура (новые и изменённые модули)

```
review-parser/
├── main.py                      # [MODIFY] — добавить --mode alert, подключить pipeline
├── scraper.py                   # [MODIFY] — собирать app metadata (version, recentChanges)
├── analyzer.py                  # [MODIFY] — вызывать classifier, передавать version context
├── classifier.py                # [NEW] — классификация отзывов через Claude
├── alerts.py                    # [NEW] — детекция spike'ов, генерация alert-отчёта
├── version_tracker.py           # [NEW] — отслеживание истории версий приложения
├── prompts/
│   ├── analyze_batch.txt        # [KEEP] — текущий анализ тем
│   ├── executive_summary.txt    # [KEEP] — текущее executive summary
│   ├── classify_batch.txt       # [NEW] — классификация отзывов
│   └── alert_report.txt         # [NEW] — генерация alert-отчёта
├── data/
│   ├── {package}.json           # [KEEP] — кэш отзывов (как есть)
│   └── {package}_versions.json  # [NEW] — история версий + changelog
└── reports/
    └── alerts/                  # [NEW] — alert-отчёты отдельно
```

---

## Шаги реализации

### Шаг 1: `version_tracker.py` — Отслеживание версий

Новый модуль. Накапливает историю версий приложения.

**Что делает:**
- При каждом запуске вызывает `google_play_scraper.app()` и записывает в `data/{package}_versions.json`:
  ```json
  {
    "package_name": "com.herocraft.game.tempest.lite",
    "versions": [
      {
        "version": "1.7.11",
        "first_seen": "2026-02-08T12:00:00Z",
        "recent_changes": "Bug fixes and performance improvements",
        "last_updated_on": "Sep 3, 2025"
      }
    ]
  }
  ```
- Если текущая версия новая — добавляет запись
- Если уже есть — не дублирует

**Функции:**
- `load_version_history(package_name) -> list[dict]`
- `update_version_history(package_name, app_metadata) -> list[dict]`
- `get_current_version(package_name) -> dict | None`
- `get_previous_version(package_name) -> dict | None`

**Файлы:** `version_tracker.py`, `data/{package}_versions.json`

---

### Шаг 2: `scraper.py` — Расширить сбор метаданных

**Изменения в `scraper.py`:**
- В `_fetch_app_name()` → переименовать в `fetch_app_metadata()`, возвращать полный dict:
  ```python
  {
    "app_name": str,
    "version": str,
    "recent_changes": str,     # changelog!
    "last_updated_on": str,
    "score": float,
    "ratings": int,
    "histogram": list[int],
  }
  ```
- В `fetch_reviews()` возвращать `app_metadata` рядом с reviews
- Вызвать `version_tracker.update_version_history()` при каждом сборе

**Файлы:** `scraper.py`

---

### Шаг 3: `classifier.py` — Классификация отзывов

Новый модуль. Классифицирует каждый отзыв через Claude.

**Категории:**
- `new_bug` — новая проблема, ранее не встречавшаяся
- `known_issue` — повторение известной проблемы
- `feature_request` — запрос новой фичи или улучшения
- `praise` — похвала (положительный шум)
- `noise` — неинформативный отзыв ("good", "bad", эмодзи)

**Архитектура:**
- Батч-обработка (50 отзывов за раз, как в текущем `analyzer.py`)
- В промпт передаётся **контекст**: changelog текущей версии + список known_issues из предыдущих запусков
- Claude возвращает для каждого отзыва:
  ```json
  {
    "review_id": "...",
    "category": "new_bug|known_issue|feature_request|praise|noise",
    "subcategory": "crash|performance|ui|balance|monetization|...",
    "device_mention": "Samsung S24" | null,
    "confidence": 0.0-1.0,
    "summary": "краткое описание проблемы"
  }
  ```
- Семафор на 4 параллельных батча (как в analyzer.py)

**Промпт `prompts/classify_batch.txt`:**
- Роль: Senior QA analyst для мобильных игр
- Контекст: текущий changelog, список known issues
- Чёткие определения каждой категории с примерами
- Инструкция извлекать device/OS из текста если упоминается

**Функции:**
- `classify_reviews(reviews, changelog, known_issues) -> list[dict]`
- `_classify_batch(client, batch, prompt) -> list[dict]`

**Файлы:** `classifier.py`, `prompts/classify_batch.txt`

---

### Шаг 4: `alerts.py` — Детекция аномалий и генерация алертов

Новый модуль. Анализирует классифицированные отзывы и генерирует alert-отчёт.

**Логика детекции:**
1. Группировка по версии: отзывы `version == current` vs `version == previous`
2. **Spike detection**: если за 48 часов после `first_seen` новой версии количество `new_bug` отзывов > 2x baseline (среднее за 7 дней предыдущей версии) → alert
3. **New issue clustering**: группировка `new_bug` отзывов по `subcategory` → если одна subcategory набрала >= 3 упоминаний → alert
4. **Device clustering**: если `device_mention` != null, группировать проблемы по устройствам

**Alert-отчёт через Claude** (`prompts/alert_report.txt`):
- Вход: classified reviews, version history, spike metrics
- Выход: структурированный markdown alert:
  ```
  ## Alert: Post-Update Issue Detected

  **App:** Pirates Flag | **Version:** 1.7.11 → 1.7.12
  **Period:** 48h post-update | **New bugs:** 15 (baseline: 3/day)

  ### New Issue: Crash on Launch (8 reports)
  - Devices: Samsung S24 (3), Pixel 8 (2), other (3)
  - Quotes: "..."
  - Recommendation: Check compatibility with Android 15 API changes

  ### Escalated Known Issue: Slow Loading (5 reports, was 1/day)
  - Severity increased 5x after update
  - Recommendation: Profile startup performance on update path
  ```

**Функции:**
- `detect_alerts(classified_reviews, version_history, stats) -> list[Alert]`
- `generate_alert_report(alerts, app_name, ...) -> str` (Claude call)
- `_calculate_baseline(reviews, version_history) -> dict`

**Файлы:** `alerts.py`, `prompts/alert_report.txt`

---

### Шаг 5: `main.py` — Новый режим `--mode alert`

**Изменения:**
- Добавить аргумент `--mode` с вариантами `report` (текущий) и `alert` (новый)
- В режиме `alert`:
  1. Собрать отзывы (scraper) + обновить version history
  2. Классифицировать отзывы (classifier)
  3. Детектировать аномалии (alerts)
  4. Сгенерировать alert-отчёт
  5. Сохранить в `reports/alerts/`
- В режиме `report` — текущее поведение без изменений

**Pipeline `alert` mode:**
```
main.py --mode alert "com.herocraft.game.tempest.lite" --max-reviews 300
  ↓
[1/4] fetch_reviews() + fetch_app_metadata() + update_version_history()
  ↓
[2/4] classify_reviews(reviews, changelog, known_issues)
  ↓
[3/4] detect_alerts(classified, version_history)
  ↓
[4/4] generate_alert_report() → reports/alerts/{app}_{date}.md
```

**Файлы:** `main.py`

---

## Порядок реализации

1. `version_tracker.py` — независимый модуль, можно тестировать отдельно
2. `scraper.py` — расширение метаданных
3. `prompts/classify_batch.txt` — написать промпт классификации
4. `classifier.py` — классификатор на базе промпта
5. `prompts/alert_report.txt` — написать промпт алерта
6. `alerts.py` — детекция + генерация
7. `main.py` — подключить `--mode alert`

---

## Верификация

1. **Unit-проверка version_tracker**: запустить сбор метаданных HeroCraft, убедиться что `data/com.herocraft.game.tempest.lite_versions.json` создан
2. **Проверка classifier**: запустить классификацию на кэшированных 50 отзывах HeroCraft, проверить что каждый отзыв получил категорию
3. **End-to-end alert pipeline**:
   ```bash
   python main.py --mode alert "com.herocraft.game.tempest.lite" --max-reviews 300
   ```
   Проверить:
   - `data/com.herocraft.game.tempest.lite_versions.json` содержит текущую версию
   - `reports/alerts/` содержит alert-отчёт
   - Отчёт содержит разбивку по категориям (new_bug/known_issue/feature_request)
4. **Обратная совместимость**: убедиться что `python main.py "..." --max-reviews 300` (без --mode) работает как раньше
