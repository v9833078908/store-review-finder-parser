# Отчет анализа встреч и доработок для review-parser

**Дата:** 2026-02-16  
**Контекст:** анализ продуктовых ожиданий по итогам встреч + сопоставление с текущей реализацией `review-parser`.

## 1. Что было проанализировано

### Встречи (основной вход)
1. `/Users/eli/Library/Mobile Documents/iCloud~md~obsidian/Documents/0️⃣ IFree/AI Gamedev Discovery/01_Meetings/02.12.26 Короткий обзор прототипа с Ильей продюсером.md`
2. `/Users/eli/Library/Mobile Documents/iCloud~md~obsidian/Documents/0️⃣ IFree/AI Gamedev Discovery/01_Meetings/02.12.26 Павел Костин обзор прототипа + короткий фидбек Проконичева.md`

### Референс-артефакт формата отчета
1. `/Users/eli/Library/Mobile Documents/iCloud~md~obsidian/Documents/0️⃣ IFree/AI Gamedev Discovery/02_Assets/0-ST2 January 2026 Community&Support Report.docx.pdf`

### Артефакты текущей реализации (репозиторий)
1. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/README.md`
2. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/pipeline.py`
3. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/report_builder.py`
4. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/server.py`
5. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/storage.py`
6. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/prompts/unified_report.txt`
7. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/app/command-center/page.tsx`
8. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/lib/runtime-mapper.ts`
9. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/lib/dashboard-preferences.tsx`
10. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/app/issues/page.tsx`
11. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/app/alerts/page.tsx`
12. `/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/frontend/src/app/reviews/page.tsx`

---

## 2. Ключевые выводы из встреч

1. Нужен **единый командный центр** с быстрым верхнеуровневым ответом, а не разрозненные отчеты.
2. Внутри этого единого отчета нужны **разные слои чтения** (управленческий vs сигнальный vs детализация), чтобы не смешивать смыслы.
3. Главный запрос продюсера: **краткая сводка на русском** (примерно полстраницы), которую можно читать ежедневно по нескольким проектам.
4. Сигналы/алерты ценны только при низком уровне ложных срабатываний и понятном контексте.
5. Абсолютные значения недостаточны: важны **доли/проценты** и контекст выборки.
6. Нужно показывать значимость проблем на верхнем уровне: не просто "new issues", а "важно/неважно и почему".
7. Нужна **кастомизация под роль** (продюсер, саппорт, разработка) и ручная настройка поверх пресета.
8. Блок действий не должен выглядеть как фальшивый таск-трекер: AI-рекомендации должны быть отделены от реальных задач.
9. Интеграция community/support источников важна стратегически, но для v1 допустим фокус на Google Play при явном обозначении ограничений.

---

## 3. Gap-анализ: текущее состояние vs ожидания

### 3.1 Слои отчета
**Сейчас:** единый `synthesis_markdown` с секцией `Alerts & New Issues` внутри одного линейного текста.  
**Ожидание:** единый отчет, но разделенный на слои (табы): `Сводка`, `Сигналы`, `Проблемы`, `Действия`.

### 3.2 Каноничный формат данных
**Сейчас:** есть JSON-артефакт + markdown-экспорт; UI частично завязан на markdown panel.  
**Ожидание:** UI должен быть канонично JSON/API-driven, без зависимости от markdown как источника.

### 3.3 Кастомизация
**Сейчас:** в preferences есть язык/период; нет серверной конфигурации табов/виджетов/KPI.  
**Ожидание:** API-конфиг с ролевыми пресетами + ручная кастомизация + персистентность.

### 3.4 Верхнеуровневая объяснимость
**Сейчас:** часть KPI неочевидна для пользователя (например, интерпретация репутации/новых проблем).  
**Ожидание:** на верхнем уровне должны быть понятные формулировки, проценты, контекст важности и причины.

### 3.5 Маршрутизация
**Сейчас:** отдельные страницы `/issues`, `/alerts`, `/reviews` работают.  
**Ожидание:** их сохранить как drill-down, не удалять.

---

## 4. Список доработок (приоритетный)

## P0 (обязательно для v1)
1. Перевести report-контракт на `report_layers` (4 слоя): `summary`, `signals`, `issues`, `actions`.
2. Заменить markdown-панель на tabbed layered report в `Command Center`.
3. Ввести серверный API конфигурации:
   - `GET /api/dashboard-config`
   - `PUT /api/dashboard-config`
4. Добавить ролевые пресеты: `producer` (default), `support`, `engineering`.
5. Добавить ручную кастомизацию табов/виджетов/KPI поверх ролевого пресета.
6. Сохранить совместимость:
   - `/api/report*` продолжают работать;
   - `markdown` оставить как deprecated-поле на переходный период;
   - `/issues`, `/alerts`, `/reviews` остаются рабочими.

## P1 (желательно в рамках этого цикла)
1. Добавить явные индикаторы важности для проблем (`high/medium/low`) и объяснение причины важности.
2. Добавить в слое `summary` контекст:
   - доля негатива (%),
   - объем выборки,
   - предупреждение о низкой достоверности при малом объеме.
3. Добавить snapshot `dashboard_config_snapshot` в run artifact для воспроизводимости.

## P2 (после v1)
1. Интеграция support/community источников (Zendesk/Discord/игровой чат).
2. Разделение AI-рекомендаций и реальных задач через внешнюю систему задач.
3. Каналы доставки сигналов (email/webhook) с настройкой порогов и анти-шум механикой.

---

## 5. Целевой контракт данных (v1)

```json
{
  "report_layers": {
    "summary": {
      "title": "Сводка",
      "narrative": "...",
      "cards": [{"id": "...", "title": "...", "value": "..."}],
      "metrics": {"negative_share": 0.0, "sample_size": 0},
      "updated_at": "2026-02-16T00:00:00Z"
    },
    "signals": {
      "title": "Сигналы",
      "narrative": "...",
      "cards": [],
      "metrics": {},
      "updated_at": "..."
    },
    "issues": {
      "title": "Проблемы",
      "narrative": "...",
      "cards": [],
      "metrics": {},
      "updated_at": "..."
    },
    "actions": {
      "title": "Действия",
      "narrative": "...",
      "cards": [],
      "metrics": {},
      "updated_at": "..."
    }
  }
}
```

---

## 6. Решения по UX (зафиксировано)

1. Единый дашборд остается на `Command Center`.
2. Табы слоев отчета встраиваются в этот экран.
3. Виджеты сверху сохраняются как текущая сильная часть UX.
4. Детальные разделы остаются в отдельных рабочих страницах как "провалиться глубже".

---

## 7. Риски и меры

1. **Риск:** регрессия из-за миграции с `markdown` на `report_layers`.  
   **Мера:** держать deprecated `markdown` и dual-read в переходный период.

2. **Риск:** разрыв между ролью и ручной настройкой.  
   **Мера:** явный режим "preset + overrides" и хранение итоговой effective-конфигурации.

3. **Риск:** усложнение UI при избыточных настройках.  
   **Мера:** минимальный набор на v1 (табы/виджеты/KPI), без продвинутых сценариев.

4. **Риск:** ложная уверенность при малом объеме отзывов.  
   **Мера:** обязательный confidence banner в summary-слое.

---

## 8. Definition of Done (по итогам этого анализа)

1. В API и артефакте есть структурированные `report_layers`.
2. На `Command Center` отображается единый layered report с табами.
3. Кастомизация через API работает и переживает перезагрузку.
4. Существующие drill-down страницы не сломаны.
5. Документация отражает модель "один dashboard + один layered report".

---

## 9. Связанный implementation-план

Актуальный implementation-план сохранен отдельно:  
`/Users/eli/Documents/PythonProjects/gamedev tools/review-parser/docs/plans/2026-02-16-unified-dashboard-layered-report-plan.md`

