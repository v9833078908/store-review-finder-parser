# Steam Reviews Design

**Goal:** Add `steam` as a new review source that fetches Steam Store reviews by direct app URL and integrates with both single-source and multi-source report flows.

## Scope
- MVP input: direct Steam Store URL only, e.g. `https://store.steampowered.com/app/4011110/Pirate_Ships/`
- Fetch reviews from Steam Store reviews endpoint using `app_id` extracted from URL
- Support language selection in UI, default `ru`
- Support period filtering via existing backend window filtering (`7d/14d/30d/90d/custom`)
- Integrate into combined multi-source flow

## Architecture
- New source module `sources/steam.py`
- Source API: `fetch_steam_reviews(url, max_reviews, lang="ru", force_refresh=False, cache_ttl=...)`
- URL parsing extracts Steam `app_id`
- Reviews fetched from Steam Store reviews endpoint using cursor pagination
- Source normalizes reviews into the existing internal schema
- Backend reuses current window filtering instead of trying to constrain fetch server-side by date range

## Data Flow
1. Validate Steam URL and extract `app_id`
2. Call Steam reviews endpoint with `app_id`, `language`, `num_per_page`, `cursor`, `filter=recent`, `purchase_type=all`, `review_type=all`
3. Continue pagination until `max_reviews` reached or endpoint exhausted
4. Normalize each review into internal payload shape
5. Return standard source payload consumed by `server.py`
6. Backend applies existing date window filter and pipeline

## Error Handling
- Invalid Steam URL -> `ValueError` -> backend `422`
- Invalid endpoint payload / missing expected fields -> source error -> backend `502/503`
- No reviews after window filter -> controlled empty result, not transport failure
- In multi-source mode, `steam` failure must not block other stores

## UI Contract
- Add `steam` to single-source store select
- Add direct-URL validation flow for Steam, similar to `vk_play` / `yandex_games`
- Show language input and period input
- Hide region field
- Add `steam` to combined source selector with direct URL, lang, period fields

## Notes
- MVP does not implement title search or resolve flow by name
- MVP uses public store reviews only, no community/discussions scraping
- If Steam endpoint behavior changes, source remains isolated in `sources/steam.py`
