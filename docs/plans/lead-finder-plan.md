# Lead Finder — Web Service для лидгена по Google Play

## Context

Existing review-parser (Python) анализирует отзывы конкретного приложения. Новый сервис **lead-finder** — отдельное Next.js приложение в подпапке `lead-finder/`, которое сканирует топ-чарты Google Play, считает reply rate разработчиков и выдаёт CSV с потенциальными лидами (приложения, где разработчик не отвечает на отзывы).

---

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js (App Router, Node.js runtime) |
| UI | shadcn/ui + Tailwind CSS + Lucide icons |
| Language | TypeScript (ESM) |
| Scraping | `google-play-scraper` npm (list, app, reviews) |
| Port | **51100** (strictPort) |

---

## Структура проекта

```
review-parser/
└── lead-finder/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── components.json
    ├── .env.example
    ├── .gitignore
    ├── (docs in ../README.md)
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              # Main page: form + results + SSE client
    │   │   ├── globals.css
    │   │   └── api/scan/route.ts     # SSE endpoint — scraping pipeline
    │   ├── lib/
    │   │   ├── types.ts              # ScanParams, AppResult, ScanEvent
    │   │   ├── constants.ts          # Collections, categories, defaults
    │   │   ├── scraper.ts            # fetchTopApps, fetchAppDetails, fetchReviews
    │   │   ├── analyzer.ts           # analyzeReviews, calculateLeadScore
    │   │   └── csv.ts                # generateCsv (client-side)
    │   └── components/
    │       ├── ui/                   # shadcn
    │       ├── scan-form.tsx         # Filter form
    │       ├── progress-panel.tsx    # Progress bar + status
    │       ├── results-table.tsx     # Sortable table
    │       └── export-button.tsx     # CSV download
    └── public/
```

---

## Архитектура / Data Flow

```
Browser (EventSource)  ──GET /api/scan?params──>  Next.js API Route
                                                      │
                                                      ├─ gplay.list() → appId[]
                                                      │
                                                      │  for each app:
                                                      ├─ gplay.app(appId) → details
                                                      ├─ gplay.reviews(appId) → reviews[]
                                                      ├─ analyzeReviews() → metrics
                                                      ├─ calculateLeadScore() → score
                                                      │
                                                      └─ SSE: result, progress, error, done

CSV генерируется на клиенте из массива результатов (без server round-trip).
```

**Streaming (SSE)** — browser получает результаты по мере обработки каждого приложения. Real-time progress + промежуточные результаты.

---

## CSV Output — колонки (в порядке приоритета)

```
developer,title,url,no_reply_rate,no_reply_rate_neg,unanswered_neg_30d,lead_score,appId,developerEmail,score,total_reviews_count,sample_size
```

| Колонка | Описание |
|---------|----------|
| **developer** | Имя разработчика |
| **title** | Название игры |
| **url** | Ссылка на Google Play |
| **no_reply_rate** | Доля неотвеченных отзывов (%, все звёзды) |
| **no_reply_rate_neg** | Доля неотвеченных негативных отзывов (%, 1-2 звезды) |
| **unanswered_neg_30d** | Кол-во неотвеченных негативных за 30 дней |
| **lead_score** | Скоринг лида (0-100, выше = лучше лид) |
| appId | Package ID |
| developerEmail | Email разработчика |
| score | Рейтинг в сторе |
| total_reviews_count | Всего отзывов в сторе |
| sample_size | Кол-во отзывов в выборке |

Пример строки:
```
Dev Studio,Example Game,https://play.google.com/store/apps/details?id=com.example,87.5,94.8,8,78,com.example,dev@example.com,3.8,15000,400
```

> **Ключевая метрика — `no_reply_rate`** (100 - reply_rate): "какой % отзывов остался без ответа". Чем выше — тем лучше лид.

---

## Ключевые файлы

### `src/lib/types.ts`
- `ScanParams` — входные параметры формы
- `AppResult` — строка результата (колонки выше)
- `ScanEvent` — SSE events: progress | result | error | done

### `src/lib/scraper.ts`
- `fetchTopApps(collection, category, country, lang, num)` → appId[] (через `gplay.list()`)
- `fetchAppDetails(appId, lang, country)` → AppDetails
- `fetchReviews(appId, lang, country, maxReviews)` → ReviewData[] (без userName/userImage)
- `withRetry()` — 3 попытки, exponential backoff

### `src/lib/analyzer.ts`
- `analyzeReviews(reviews, windowDays, minAgeDays)` — no_reply_rate, no_reply_rate_neg, unanswered_neg_30d
- `calculateLeadScore()`:
  - 30pts: high no_reply_rate (overall)
  - 30pts: high no_reply_rate_neg (1-2 stars)
  - 20pts: recent unanswered negatives (last 30d, capped at 10)
  - 10pts: app size (log scale, bigger = better lead)
  - 10pts: low store rating (more room for improvement)

### `src/app/api/scan/route.ts`
- GET handler, returns SSE ReadableStream
- Sequential app processing, 1s delay between apps
- Per-app error isolation (skip and continue)
- `maxDuration = 300` (5 min)

### `src/app/page.tsx`
- Client component: idle → scanning → done/error
- EventSource для SSE
- useState для results[], progress, errors

### UI Components (shadcn)
- **scan-form**: Select (collection, category), Input (country, lang, numbers), Button
- **progress-panel**: Progress bar + текущий app + elapsed time
- **results-table**: Table с client-side sort, color-coded lead_score (Badge)
- **export-button**: Blob → download CSV

---

## Rate Limiting / Error Handling

- **1s delay** между приложениями, **500ms** между страницами отзывов
- **Retry**: 3 попытки с exponential backoff (1s, 2s, 4s)
- **Ошибки** изолированы на уровне app — skip + continue + report
- Примерное время: 200 apps ≈ 12 минут

---

## Шаги реализации

1. **Scaffold** Next.js + shadcn/ui + install `google-play-scraper`
2. **types.ts + constants.ts** — типы и dropdown options
3. **scraper.ts** — обёртки над gplay с retry
4. **analyzer.ts** — no_reply_rate + lead score
5. **csv.ts** — генерация CSV строки
6. **api/scan/route.ts** — SSE endpoint, основной pipeline
7. **UI components** — form, progress, table, export
8. **page.tsx** — wiring: form → SSE → table → export
9. **Обновить единый `../README.md`** с инструкцией запуска и примером

---

## Верификация

1. `cd lead-finder && npm run dev` → opens on port 51100
2. Установить фильтры: TOP_FREE, GAME, us, en, max_apps=5, max_reviews=50
3. Нажать Start Scan → видим прогресс + результаты в таблице
4. Нажать Export CSV → скачивается файл с правильными колонками (developer первый, no_reply_rate — ключевая метрика)
5. Проверить что userName/userImage отсутствуют в коде
