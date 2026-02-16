# Alert Mode Usage Guide

> Canonical project documentation lives in `review-parser/README.md` (single README policy).

## Overview

Alert mode превращает Review Parser в **pipeline мониторинга обновлений**, который автоматически:
- Классифицирует отзывы (new_bug, known_issue, feature_request, praise, noise)
- Отслеживает историю версий приложения
- Детектирует аномалии (spike detection, issue clustering)
- Генерирует alert-отчёты с actionable рекомендациями

## Quick Start

### 1. Обычный режим (без изменений)
```bash
python main.py "com.example.game" --max-reviews 2000 --langs en,ru
```
Генерирует стандартный аналитический отчёт в `reports/`.

### 2. Alert режим
```bash
python main.py --mode alert "com.example.game" --max-reviews 300 --langs en
```
Генерирует alert-отчёт в `reports/alerts/`.

## Что делает Alert Mode

### Pipeline (4 этапа)

**[1/4] Fetch reviews + app metadata**
- Собирает отзывы через Google Play API
- Получает метаданные: `version`, `recent_changes` (changelog), `last_updated_on`
- Обновляет историю версий в `data/{package}_versions.json`

**[2/4] Classify reviews**
- Классифицирует каждый отзыв через Claude
- Категории:
  - `new_bug` — новая техническая проблема
  - `known_issue` — повторение известного бага
  - `feature_request` — запрос фичи
  - `praise` — положительный шум
  - `noise` — неинформативный отзыв
- Извлекает subcategory (crash, performance, ui, etc.) и device mentions

**[3/4] Detect alerts**
- **Spike detection**: new_bug count > 2x baseline (из предыдущей версии)
- **Issue clustering**: >= 3 отзыва с одной subcategory → alert
- **Critical subcategories**: crash, progression_loss, login_auth всегда триггерят alert

**[4/4] Generate alert report**
- Claude генерирует markdown отчёт с:
  - Executive summary
  - New Issues (с quotes и device breakdown)
  - Escalated Known Issues
  - Feature Requests Trend
  - Prioritized Recommendations (Immediate/Short-term/Monitor)

## Примеры

### Анализ нового обновления
```bash
# Сразу после релиза версии 1.2.5
python main.py --mode alert "com.herocraft.game.tempest.lite" --max-reviews 300 --langs en

# Outputs:
# Version: 1.2.4 → 1.2.5
# Alerts detected: 3
# Alert report saved: reports/alerts/Pirates_Flag_alert_2026-02-10.md
```

### Мониторинг стабильной версии (без новых проблем)
```bash
python main.py --mode alert "com.example.stable" --max-reviews 200 --langs en

# Outputs:
# Alerts detected: 0
# Alert report: "No significant new issues detected. Continue monitoring quality."
```

## Структура файлов

### Version History (`data/{package}_versions.json`)
```json
{
  "package_name": "com.example.game",
  "versions": [
    {
      "version": "1.2.4",
      "first_seen": "2026-01-15T10:00:00Z",
      "recent_changes": "Bug fixes and performance improvements",
      "last_updated_on": "Jan 14, 2026"
    },
    {
      "version": "1.2.5",
      "first_seen": "2026-02-01T14:30:00Z",
      "recent_changes": "New level pack added!",
      "last_updated_on": "Feb 1, 2026"
    }
  ]
}
```

### Alert Report Structure
```markdown
# Post-Update Alert Report: [App Name]

**Version:** [Prev] → [Current] | **Period:** [Dates] | **Alert triggered:** [Yes/No]

## Executive Summary
[2-3 sentences on severity and business impact]

## New Issues Detected
### [Issue Name] ([N] reports)
- **Severity:** Critical/High/Medium/Low
- **Affected devices:** [Device breakdown]
- **Representative quotes:** [...]
- **Recommendation:** [Specific action]

## Escalated Known Issues
[Known issues that spiked vs baseline]

## Feature Requests Trend
[Top requested category if >= 5 mentions]

## Recommendations Priority
1. **Immediate:** [Critical fixes]
2. **Short-term:** [Follow-up work]
3. **Monitor:** [Metrics to track]
```

## Advanced Usage

### Настройка batch size
По умолчанию classifier обрабатывает 30 отзывов за раз. Для изменения:
```python
# classifier.py
DEFAULT_BATCH_SIZE = 30  # Уменьшить если упираетесь в token limits
```

### Кастомизация alert thresholds
```python
# alerts.py, detect_alerts()
# Spike detection: 2x baseline → можно изменить на 1.5x или 3x
if len(new_bugs_in_window) > baseline_new_bug_per_day * 2 * 2:
    ...

# Issue clustering: >= 3 mentions → можно изменить на 5
if count >= 3:
    ...
```

### Добавление known_issues контекста
Пока known_issues передаётся пустым списком. Можно расширить:
```python
# main.py, _run_alert_mode()
# TODO: Load known issues from previous classifications
known_issues = [
    "Facebook login fails on Android 15",
    "Slow loading on devices with < 2GB RAM",
]
```

## Troubleshooting

### Error: "No JSON payload found in model response"
- **Причина:** Claude вернул truncated response (превышен max_tokens)
- **Решение:** Уменьшить `DEFAULT_BATCH_SIZE` в `classifier.py` (с 30 до 20)

### Error: "ANTHROPIC_API_KEY is missing"
- **Решение:** Создать `.env` файл:
  ```
  ANTHROPIC_API_KEY=your-key-here
  ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
  ```

### Alerts detected: 0 (но проблемы есть)
- **Причина:** Недостаточно данных для baseline (нет previous version)
- **Решение:** Запустить pipeline несколько раз — после второго запуска появится baseline

### Alert report содержит неполные device mentions
- **Ожидаемо:** Google Play API не предоставляет device info, только упоминания в тексте
- **Улучшение:** Пользователи редко упоминают модели — можно расширить промпт на извлечение OS versions

## Model Usage & Costs

### Claude API Calls (для 300 отзывов)
- **Classification:** 300 reviews / 30 batch = 10 API calls (~40k input + 12k output tokens)
- **Alert report:** 1 API call (~8k input + 1.5k output tokens)
- **Total:** ~11 calls, ~60k tokens (~$0.30 per run на Sonnet 4.5)

### Рекомендации по оптимизации
- Для мониторинга: запускать 1 раз в 24-48 часов после релиза
- Использовать кэш (reviews cache TTL = 24h)
- Для batch jobs: переключиться на Haiku для classification (10x дешевле)

## Next Steps

### Расширения для production
1. **Persistent known_issues tracking**
   - Сохранять классифицированные баги в `data/{package}_known_issues.json`
   - Передавать в следующий запуск для улучшения классификации

2. **Multi-version comparison**
   - Сравнивать метрики между 3-5 последними версиями
   - Визуализировать тренды (crash rate, feature request volume)

3. **Webhook notifications**
   - Отправлять alert в Slack/Discord при trigger
   - Автоматизировать через cron/GitHub Actions

4. **Device analytics**
   - Парсить device info из User-Agent (если доступно в API)
   - Кросс-референс с crash analytics (Firebase, Sentry)

5. **A/B testing support**
   - Сегментировать отзывы по версии для phased rollouts
   - Детектировать проблемы только у части пользователей
