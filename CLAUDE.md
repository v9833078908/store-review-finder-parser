# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Documentation policy: use `review-parser/README.md` as the single README entrypoint for all components (`review-parser`, `lead-finder`, `frontend`).

## Project Overview

Multi-modal tool suite for analyzing Google Play app reviews. Two main components:

1. **Review Parser (Python)** — CLI tool with two modes:
   - **Report mode** (default): Fetches reviews → extracts themes via Claude → generates markdown report with severity, sentiment, and executive summary
   - **Alert mode** (`--mode alert`): Fetches reviews → classifies each (bug/feature/praise/noise) → detects anomalies (spikes, clusters, critical issues) → generates actionable alert report

2. **Lead Finder (`lead-finder/`)** — Next.js web app that scans Google Play top charts, calculates developer reply rates, and scores leads for outreach. Uses SSE for real-time progress.

## Commands

### Python Review Parser

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Run report mode
python main.py "com.example.app" --max-reviews 100 --langs en

# Run alert mode
python main.py --mode alert "com.example.app" --max-reviews 300 --langs en

# Docker
docker compose build
docker compose run --rm review-parser "https://play.google.com/store/apps/details?id=com.example.app" --max-reviews 50 --langs en,ru
```

### Lead Finder

```bash
cd lead-finder
npm install
npm run dev    # http://localhost:51100
npm run build  # Production build
```

### No test suite or linter is configured.

## Architecture

### Data Flow — Report Mode
`main.py` → `scraper.fetch_reviews()` (cached 24h in `data/`) → `analyzer.analyze_reviews()` (batches of 50, 4 concurrent via semaphore) → theme merging (fuzzy match 82%) → executive summary → markdown report in `reports/`

### Data Flow — Alert Mode
`main.py` → `scraper.fetch_reviews()` + `fetch_app_metadata()` → `version_tracker.update_version_history()` → `classifier.classify_reviews()` (batches of 30) → `alerts.detect_alerts()` (spike detection: >2x baseline) → `alerts.generate_alert_report()` → markdown in `reports/alerts/`

### Key Patterns
- **Prompts live in `prompts/`** as `.txt` templates with `{{VARIABLE}}` placeholders — never hardcode prompts
- **All Claude API calls use `AsyncAnthropic`** with `asyncio`, semaphore-limited concurrency (`MAX_BATCH_CONCURRENCY = 4`), and retry logic (3 attempts, exponential backoff)
- **Reviews are cached** in `data/{package}.json` with 24h TTL to avoid repeated API calls
- **Version history** persisted in `data/{package}_versions.json`

## Configuration

Requires `.env` file (or env vars):
```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

The `.env` file is loaded from the parent directory (`../`) relative to the project root.

## Key Files

| File | Role |
|------|------|
| `main.py` | CLI entry point, mode routing |
| `scraper.py` | Google Play review/metadata fetching + caching |
| `analyzer.py` | Theme extraction, batch processing, report generation |
| `classifier.py` | Review classification (5 categories + subcategories) |
| `alerts.py` | Anomaly detection + alert report generation |
| `version_tracker.py` | Version history tracking |
| `prompts/*.txt` | All LLM prompt templates |
| `lead-finder/src/app/api/scan/route.ts` | SSE scan pipeline |
| `lead-finder/src/lib/analyzer.ts` | Lead scoring algorithm |
