from __future__ import annotations

# ---------------------------------------------------------------------------
# Batch sizes
# ---------------------------------------------------------------------------
THEME_BATCH_SIZE = 50
CLASSIFY_BATCH_SIZE = 30
NOISE_GATE_BATCH_SIZE = 40
COMMUNITY_CLASSIFY_BATCH_SIZE = 30
TRANSLATION_BATCH_SIZE = 25

# ---------------------------------------------------------------------------
# Concurrency
# ---------------------------------------------------------------------------
DEFAULT_MAX_CONCURRENCY = 4
SHARED_PIPELINE_CONCURRENCY = 6

# ---------------------------------------------------------------------------
# Alert detection
# ---------------------------------------------------------------------------
SPIKE_MULTIPLIER = 2.0
SPIKE_WINDOW_HOURS = 48
MIN_SPIKE_COUNT = 5
MIN_BASELINE_DAYS = 2
NEW_ISSUE_CLUSTER_THRESHOLD = 3
CRITICAL_SUBCATEGORIES: frozenset[str] = frozenset({"crash", "progression_loss", "login_auth"})

# ---------------------------------------------------------------------------
# Scraper / cache
# ---------------------------------------------------------------------------
SCRAPER_PAGE_DELAY = 2
SCRAPER_CACHE_TTL_HOURS = 24

# ---------------------------------------------------------------------------
# Community classifier
# ---------------------------------------------------------------------------
THREAD_GAP_SECONDS = 300
THREAD_CONTEXT_WINDOW = 5
