# Community Chat Classifier Pipeline

Two-pass LLM pipeline for classifying community chat messages (Telegram / Discord) into product-relevant topics with sentiment.

## How it works

```
CSV → Load & normalize columns
  → Group messages into threads (by 5-min time gap)
    → Pass 1: Noise Gate (binary signal/noise per message, using thread context)
      → Pass 2: Topic Classification (11 topics + sentiment, only for signal)
        → JSON output with summary stats
```

**Why two passes?**
A single-pass classifier conflates two tasks: "is this about the game?" and "what topic is it?". Splitting them raises classification confidence from ~0.57 to ~0.76 and reduces false "undefined" labels from 69% to 45%.

**Why thread context?**
A message like "yes, same here" is meaningless alone but valuable when the previous message reports a bug. We send 5 preceding messages as context to the LLM.

## Quick start

```bash
# 1. Install
pip install anthropic

# 2. Set API key
export ANTHROPIC_API_KEY=sk-ant-...
# or create .env file:
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-5-20250929  (optional, defaults to sonnet)

# 3. Run
python community_classifier.py your_data.csv -o results.json

# With chat/channel filter:
python community_classifier.py your_data.csv --chat-id "-100123456" -o results.json
```

## CSV format

The script auto-detects column names. It looks for these (in order of priority):

| Field | Accepted column names |
|-------|----------------------|
| Message text | `comment_text`, `Текст комментария`, `text`, `message`, `content`, `body` |
| Timestamp | `created_at`, `Дата и время`, `timestamp`, `date`, `datetime`, `sent_at` |
| User ID | `user_id`, `ID пользователя`, `author_id`, `sender_id` |
| Username | `username`, `Имя пользователя`, `author`, `nick`, `handle` |
| Display name | `first_name`, `Имя`, `display_name`, `name`, `author_name` |
| Chat/Channel ID | `chat_id`, `ID чата`, `channel_id`, `server_id`, `guild_id` |

**Minimum required:** a column with message text and a column with timestamps.

### Discord export

Use [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter) to export channels as CSV. The default column names (`Content`, `Date`) should work — just add them to `FIELD_MAP` in the script if needed:

```python
# In community_classifier.py, add to FIELD_MAP:
"text": ["Content", "comment_text", ...],
"timestamp": ["Date", "created_at", ...],
"username": ["Author", "username", ...],
"chat_id": ["Channel", "chat_id", ...],
```

## Output format

```json
{
  "summary": {
    "total_messages": 3957,
    "total_threads": 956,
    "signal_count": 1787,
    "noise_count": 2170,
    "signal_pct": 45.2,
    "topic_distribution": {"gameplay": 481, "events": 394, ...},
    "sentiment_distribution": {"neutral": 1045, "negative": 463, ...},
    "avg_gate_confidence": 0.862,
    "avg_classify_confidence": 0.76
  },
  "classified": [
    {
      "msg_id": "13203",
      "timestamp": "2026-01-25 17:16:40",
      "username": "player42",
      "text": "the upgrade system is broken...",
      "gate_label": "signal",
      "gate_confidence": 0.92,
      "topic": "progression",
      "topic_secondary": "monetization",
      "sentiment": "negative",
      "classify_confidence": 0.88,
      "summary": "Frustrated with upgrade RNG: 10 consecutive failures at 40%"
    }
  ],
  "noise": [
    {"msg_id": "13208", "text": "lol", "gate_confidence": 0.95}
  ]
}
```

## Adapting for your game

### 1. Edit the topic taxonomy

Open `prompts/community_classify.txt` and replace the topic list with your game's relevant categories. Example for an RPG:

```
**combat** — Combat mechanics, skill builds, DPS discussion, boss strategies
**crafting** — Crafting system, recipes, material farming, gear progression
**pvp** — PvP balance, arena, rankings, specific class/build complaints
**guild** — Guild wars, recruitment, guild events, social features
**gacha** — Pull rates, banner discussion, pity system, premium currency value
...
```

### 2. Edit the noise gate (optional)

Open `prompts/community_noise_gate.txt`. The signal/noise definitions are generic enough to work for most games. Adjust examples if your community has specific patterns (e.g., trading bots, LFG posts).

### 3. Tuning parameters

In `community_classifier.py`, adjust these constants:

```python
THREAD_GAP_SECONDS = 300   # How many seconds of silence splits a thread
                           # Discord: try 600 (channels are slower)
                           # Telegram: 300 works well

THREAD_CONTEXT_WINDOW = 5  # How many preceding messages to include as context
                           # More = better classification but more tokens

NOISE_GATE_BATCH_SIZE = 40 # Messages per API call (pass 1)
CLASSIFY_BATCH_SIZE = 30   # Messages per API call (pass 2)
MAX_CONCURRENCY = 4        # Parallel API calls (increase if you have higher rate limits)
```

## Performance & cost

For ~4,000 messages:
- **Time:** ~10-15 minutes (4 concurrent calls, Sonnet)
- **Cost:** ~$2-4 (Sonnet pricing)
- **Breakdown:** ~100 noise gate batches + ~60 classify batches = ~160 API calls

To reduce cost:
- Use `ANTHROPIC_MODEL=claude-haiku-4-5-20251001` (3-5x cheaper, slightly lower quality)
- Increase batch sizes (fewer calls but longer prompts)

## File structure

```
community_classifier_handoff/
├── community_classifier.py          # Main script (standalone, no deps beyond anthropic)
├── prompts/
│   ├── community_noise_gate.txt     # Pass 1 prompt template
│   └── community_classify.txt       # Pass 2 prompt template
└── README.md                        # This file
```
