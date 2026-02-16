# Review Parser MVP v3 — Final Implementation Plan

## Context

Нужен простой инструмент: вставляешь ссылку на игру в Google Play → получаешь отчёт с инсайтами для продуктовой команды геймдев-студии. Существующие планы (v1 — ML-пайплайн, v2 — LLM + Streamlit) переусложнены для MVP. Делаем ещё проще: **3 файла + папка промптов**, один CLI-вызов, markdown-отчёт.

---

## Architecture

```
Google Play URL → main.py → scraper.py → analyzer.py → reports/report.md
                                              ↑
                                        prompts/*.txt
```

**Принцип:** LLM делает всю аналитику. Никакого ML, баз данных, дашбордов.

---

## File Structure

```
review-parser/
├── main.py                    # CLI entry point + orchestration (~80 lines)
├── scraper.py                 # Fetch reviews + JSON cache (~70 lines)
├── analyzer.py                # Claude API batching + report generation (~120 lines)
├── prompts/
│   ├── analyze_batch.txt      # Prompt: extract themes from batch of reviews
│   └── executive_summary.txt  # Prompt: generate actionable summary
├── requirements.txt           # 3 dependencies
├── .env.example               # ANTHROPIC_API_KEY=
├── data/                      # JSON cache (gitignored)
└── reports/                   # Generated reports (gitignored)
```

**~270 строк кода.** Никаких классов — только функции.

---

## Implementation Steps

### Step 1: Project scaffold
- Create directories: `prompts/`, `data/`, `reports/`
- `requirements.txt`: `google-play-scraper`, `anthropic`, `python-dotenv`
- `.env.example` with `ANTHROPIC_API_KEY=`
- `.gitignore`: `data/`, `reports/`, `.env`, `venv/`, `__pycache__/`
- Create & activate venv

### Step 2: `scraper.py` — fetch reviews
- `fetch_reviews(package_name, max_reviews=2000, langs=['en','ru'], country='us') -> dict`
  - Uses `google_play_scraper.reviews` with pagination
  - Fetches reviews for each language in `langs`, merges & deduplicates by review_id
  - Returns `{"app_name": ..., "fetched_at": ..., "reviews": [...]}`
  - Each review: `{review_id, date, rating, text, version, thumbs_up, lang}`
- `_load_cache(package_name) -> dict | None` — check `data/{package_name}.json`, return if < 24h old
- `_save_cache(package_name, data)` — save to `data/{package_name}.json`
- Retry logic: 3 retries with exponential backoff for network errors
- Rate limiting: 2s sleep between fetch pages

### Step 3: `analyzer.py` — LLM analysis + report
- `analyze_reviews(reviews, app_name) -> str` — main function, returns markdown report
  - Batches reviews (50 per batch)
  - Calls Claude API for each batch → extracts themes as JSON
  - Merges themes across batches (by name similarity)
  - Calls Claude API once more for executive summary
  - Assembles markdown report
- `_analyze_batch(batch, prompt_template) -> list[dict]` — single Claude API call
  - Uses `claude-sonnet-4-5-20250929` (fast + cheap)
  - Returns list of themes: `{name, sentiment, severity, count, quotes}`
- `_merge_themes(all_themes) -> list[dict]` — deduplicate & aggregate
- `_generate_summary(themes, app_name, stats, prompt_template) -> str`
- `_build_report(app_name, stats, summary, themes) -> str` — assemble markdown
- Uses `async` + `anthropic.AsyncAnthropic` per user's CLAUDE.md rule

### Step 4: `prompts/analyze_batch.txt` and `prompts/executive_summary.txt`
- `analyze_batch.txt`: instruct Claude to extract themes with name, sentiment, severity (1-5), count, representative quotes. Output: JSON.
- `executive_summary.txt`: given aggregated themes + stats, produce: top critical issues, strengths, actionable recommendations. Output: markdown.

### Step 5: `main.py` — CLI
- `parse_google_play_url(url) -> str` — extract package name via regex
- `async def main()` — orchestrate: parse URL → fetch → analyze → save report
- `argparse` with positional `url` + optional `--max-reviews` (default 2000), `--langs` (default `en,ru`), `--country`
- Load `.env` with `python-dotenv`
- Print progress to stderr, save report to `reports/{app_name}_{date}.md`

### Step 6: End-to-end test
- Run on a real game (e.g. a popular free game)
- Verify: reviews fetched, cache created, report generated, report is actionable

---

## Report Format

```markdown
# Review Analysis: {Game Name}

**Period:** last 6 months | **Reviews analyzed:** 2,000 | **Avg rating:** 3.2/5

## Executive Summary
[LLM-generated: critical issues, strengths, top recommendation]

## Critical Issues
### 1. {Theme Name} (N mentions, severity X/5)
> "quote 1"
> "quote 2"
**Affected versions:** 2.3.1, 2.3.2

## What Players Love
### 1. {Theme Name} (N mentions)
> "quote"

## All Themes
| Theme | Sentiment | Count | Severity | Avg Rating |
|-------|-----------|-------|----------|------------|
| ...   | ...       | ...   | ...      | ...        |
```

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Storage | JSON files | No setup, sufficient for MVP, easy to inspect |
| Output | Markdown | Readable everywhere, no server needed |
| LLM model | Sonnet 4.5 | Fast, cheap (~$2/2K reviews), good quality |
| CLI framework | argparse | stdlib, no extra deps |
| Async | Yes (anthropic async) | User's CLAUDE.md rule |
| Batch size | 50 reviews | Fits in context, good cost/quality balance |
| Report language | Auto | Claude определяет основной язык отзывов и пишет на нём |
| Multi-lang fetch | Yes (`--langs en,ru`) | Собираем отзывы на нескольких языках за один запуск |

---

## Dependencies

```
google-play-scraper>=1.2.7
anthropic>=0.40.0
python-dotenv>=1.0.0
```

---

## Deferred to v2
- App Store support
- SQLite / persistent storage
- Web dashboard (Streamlit)
- Historical tracking / trend comparison
- Multi-app comparison
- HTML/PDF export

---

## Verification
1. `python main.py https://play.google.com/store/apps/details?id=<real_game_id> --max-reviews 50` — quick test with 50 reviews
2. Check `data/` — cache JSON exists with correct structure
3. Check `reports/` — markdown report exists, contains all sections
4. Verify report has: executive summary, negative themes with quotes, positive themes, all themes table
5. Re-run same command — should use cache (fast), no new API calls to Google Play
