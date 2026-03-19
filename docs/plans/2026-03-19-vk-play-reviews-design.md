# VK Play Reviews Design

**Date:** 2026-03-19

## Goal

Add a new `vk_play` review source that accepts a direct VK Play game URL, fetches review metadata and reviews from VK Play APIs, and plugs into the existing report pipeline and MVP search UI.

## Findings From Live Reverse Engineering

- Game page URL example: `https://vkplay.ru/play/game/pirate-ships-46035`
- The page shell is mostly frontend bootstrap; the useful data comes from JSON APIs.
- Game metadata is available anonymously via:
  - `GET https://api.vkplay.ru/catalog/v1/game/<slug>?lang=ru_RU`
- Reviews are available anonymously via:
  - `GET https://api.vkplay.ru/play/microreviews_v2/?...&game_id=<id>...`
- Review stats are available anonymously via:
  - `GET https://api.vkplay.ru/play/microreviews/stat/?game_id=<id>&duration=all&lang=ru_RU`
- `GET https://api.vkplay.ru/social/profile/v2/session` can fail with `bad client authorization` without blocking read access to reviews.
- `GET https://api.vkplay.ru/play/microreviews/can_add/?game_id=<id>` requires auth, but that only affects adding reviews, not reading them.
- Pagination is not offset-based in the observed API. `microreviews_v2` returns a `next` URL with a `cursor` parameter.

## Architecture

Add a dedicated source module `sources/vk_play.py` that:

1. Validates a direct VK Play game URL.
2. Extracts the slug from the URL.
3. Fetches game metadata from `catalog/v1/game/<slug>`.
4. Reads the numeric game id from metadata.
5. Fetches review pages from `play/microreviews_v2`.
6. Follows the `next` URL until `max_reviews` is reached or no next page remains.
7. Normalizes the review payload into the repository's common review schema.

The source will use `httpx.AsyncClient`. No Playwright, CSRF bootstrap, or proxy integration is required for MVP.

## URL And Identity Model

- Input URL shape for MVP:
  - `https://vkplay.ru/play/game/<slug>`
- Identity used internally:
  - slug from the URL for metadata lookup
  - numeric `id` from catalog response for review/stat endpoints

Example:

- URL slug: `pirate-ships-46035`
- Catalog response id: `46035`

## Data Flow

1. Frontend sends `store=vk_play` plus the direct game URL.
2. Backend resolves dashboard params.
3. `server.py` routes `vk_play` requests to `fetch_vk_play_reviews(...)`.
4. The source fetches catalog metadata in the requested language.
5. The source fetches review pages through `microreviews_v2`.
6. Reviews are normalized and returned with metadata.
7. Backend applies the existing date-window filter for `7d/14d/30d/90d/custom`.
8. Report generation continues through the existing unified pipeline.

## Filtering Rules

Unlike `yandex_games`, `vk_play` should keep:

- language selection in the UI
- period selection in the UI
- backend date-window filtering after fetch

For MVP:

- default UI language is `ru`
- the first selected language drives VK Play request language
- region is not exposed in the UI for `vk_play`

Language mapping in the source should support at least:

- `ru` -> `ru_RU`
- `en` -> `en_US`

Unknown language inputs should fall back to `ru_RU`.

## Payload Mapping

Expected `microreviews_v2` fields observed in production:

- `id`
- `text`
- `date_added`
- `likes`
- `dislikes`
- `lang`
- `rating`
- `author.nick`
- `author.time_spend`

Normalized review shape should include:

- `review_id` from `id`
- `date` from `date_added`
- `rating`
- `text`
- `thumbs_up` from `likes`
- `original_lang` and `lang`
- `has_reply = False`
- `reply_text = None`
- `reply_date = None`

Optional source-specific metadata can include author nickname and playtime if the current artifact schema allows it.

## Error Handling

Fail closed for source and transport problems:

- invalid URL -> `ValueError`
- missing catalog entry or missing numeric id -> typed source error
- invalid JSON or unexpected schema from catalog/reviews -> typed source error
- transient network failures -> small bounded retry in source layer

Do not silently convert source failures into `0 reviews`.

Empty results are valid only when the API succeeds and the selected date window filters everything out.

## Server Integration

`server.py` changes:

- extend store pattern to include `vk_play`
- add routing branch for `fetch_vk_play_reviews(...)`
- treat `vk_play` like `yandex_games` for direct URL input, but unlike `yandex_games` keep period and language inputs active
- do not run country fanout logic for `vk_play`

## Frontend Integration

`/search-app` changes:

- add `VK Play` option to the store selector
- use direct URL validation instead of resolve endpoint
- show period field
- show language field with default `ru`
- hide region field for `vk_play`

The report page and store type unions should be extended to support `vk_play`.

## Testing Strategy

Unit tests:

- URL validation and slug extraction
- language mapping
- metadata parsing from catalog response
- review normalization
- pagination via `next`
- typed failure on invalid catalog/review payloads

Server tests:

- report route accepts `store=vk_play`
- `vk_play` follows direct URL flow
- window filtering behaves like existing stores

Frontend verification:

- `npm run build`
- manual `/search-app` run with a real VK Play URL

## Non-Goals For MVP

- review submission
- authenticated actions
- proxy support
- resolve/search endpoint for VK Play
- Playwright fallback

