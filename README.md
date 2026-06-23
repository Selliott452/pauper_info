# pauper-info

Deck and card statistics for the Magic: The Gathering **Pauper** format.

- **Backend** — Spring Boot / Kotlin REST API (`:8080`), Postgres for storage.
- **Frontend** — React + Vite SPA (`frontend/`, dev server on `:5173`).
- **Sidecar** — a small Python (FastAPI + `curl_cffi`) HTTP proxy (`:8081`) used
  only to fetch from Moxfield and mtgdecks (it impersonates a browser to get past
  Cloudflare). All parsing and business logic lives in Kotlin; the sidecar just
  returns raw response bodies.

## Prerequisites

- JDK 21+ and the Gradle wrapper (`./gradlew`)
- Postgres running locally with a database named `pauper-db` (credentials
  `postgres` / `postgres` — see `src/main/resources/application.properties`)
- Python 3.10+ for the sidecar
- Node 20+ for the frontend

## Running locally

Start these in order. All REST endpoints are served under the `/api` prefix.

1. **Sidecar** (required before any Moxfield or archetype sync):
   ```bash
   cd moxfield-proxy
   pip install -r requirements.txt
   python main.py          # serves POST /fetch on :8081
   ```

2. **API** (runs Flyway migrations automatically on startup):
   ```bash
   ./gradlew bootRun       # serves on :8080
   ```

3. **Frontend** (optional for sync; needed for the UI):
   ```bash
   cd frontend
   npm install
   npm run dev             # serves on :5173, proxies /api to :8080
   ```

## Data sync pipeline

The database is populated by triggering the steps below **in order** — each one
depends on the data produced by the previous step. Every endpoint kicks off an
**asynchronous** background job and returns immediately with `202 Accepted`, so
watch the application logs to see progress and know when a step has finished
before starting the next one.

### 1. Sync cards from Scryfall

Populates the `card` table with every pauper-legal card (one printing per card).
This must run first: deck and archetype steps resolve cards by name against this
table.

```bash
curl -X POST http://localhost:8080/api/scryfall/sync
```

### 2. Discover decks on Moxfield

Searches Moxfield for pauper decks containing each card we know about and records
their public IDs (decklists are not fetched yet). Requires the sidecar.

```bash
curl -X POST http://localhost:8080/api/moxfield/sync-all-decks
```

### 3. Fetch deck details + apply legality

Fetches the full decklist for each discovered deck, resolves its cards, and
**validates pauper legality** (every card pauper-legal, ≤4 copies except basics
and "any number" cards, ≥60 mainboard). Decks that fail are deleted. Requires
the sidecar.

```bash
# Only decks not yet fetched (resumable — safe to re-run):
curl -X POST http://localhost:8080/api/moxfield/sync-deck-details

# Re-fetch and re-validate EVERY deck (e.g. after changing legality rules):
curl -X POST "http://localhost:8080/api/moxfield/sync-deck-details?all=true"
```

### 4. Scrape archetype profiles from mtgdecks

Scrapes the per-archetype card-inclusion profiles used to classify decks, storing
them in `archetype_card`. Uses the `card` table to map double-faced card
front-face names to their full names, so run this **after** step 1. Requires the
sidecar.

```bash
curl -X POST http://localhost:8080/api/archetypes/scrape
```

### 5. Classify decks into archetypes

Scores every deck's mainboard against each archetype profile and stores the
assigned archetype plus a confidence label. Run **after** steps 3 and 4, and
re-run any time decks or profiles change.

```bash
# threshold is the minimum score to assign an archetype (else "Other"):
curl -X POST "http://localhost:8080/api/archetypes/classify?threshold=0.15"
```

### Typical full rebuild

```text
1. scryfall/sync              → cards
2. moxfield/sync-all-decks    → deck IDs
3. moxfield/sync-deck-details → decklists + legality filtering
4. archetypes/scrape          → archetype profiles
5. archetypes/classify        → deck archetype labels
```
