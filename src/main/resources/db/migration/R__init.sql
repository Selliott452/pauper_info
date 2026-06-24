-- The metagame data (scraped cards, decks, and archetype stats) lives in its own
-- schema, consistent with the tournament and casual schemas.
CREATE SCHEMA IF NOT EXISTS metagame;

-- Move any pre-existing public tables into the metagame schema (their indexes and
-- constraints move with them). No-ops once already relocated / on a fresh install.
ALTER TABLE IF EXISTS public.card SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.card_legality SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.deck SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.archetype_card SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.archetype_matchup SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.deck_card SET SCHEMA metagame;
ALTER TABLE IF EXISTS public.card_play_stats SET SCHEMA metagame;

-- Cards. id is an internal surrogate key; scryfall_id is the external identifier
-- (what the API exposes). Decks reference cards by the surrogate to keep the large
-- deck_card table narrow.
CREATE TABLE IF NOT EXISTS metagame.card (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scryfall_id UUID NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    mana_cost   TEXT,
    cmc         NUMERIC NOT NULL,
    type_line   TEXT NOT NULL,
    oracle_text TEXT,
    power       TEXT,
    toughness   TEXT,
    colors      TEXT[],
    rarity      TEXT NOT NULL,
    set_code    TEXT NOT NULL,
    image_uri   TEXT,
    back_image_uri TEXT
);

CREATE TABLE IF NOT EXISTS metagame.card_legality (
    card_id INT NOT NULL REFERENCES metagame.card(id),
    format  TEXT NOT NULL,
    status  TEXT NOT NULL,
    PRIMARY KEY (card_id, format)
);

-- Decks. id is an internal surrogate key; public_id is the Moxfield public id
-- (what the API exposes and what we fetch by).
CREATE TABLE IF NOT EXISTS metagame.deck (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id   TEXT NOT NULL UNIQUE,
    name        TEXT,
    author      TEXT,
    colors      TEXT[],
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ,
    archetype   TEXT,
    archetype_confidence TEXT
);

-- Per-archetype card profiles scraped from mtgdecks (maindeck inclusion rates).
-- These drive the archetype classifier.
CREATE TABLE IF NOT EXISTS metagame.archetype_card (
    archetype TEXT NOT NULL,
    card_name TEXT NOT NULL,
    inclusion REAL NOT NULL,
    PRIMARY KEY (archetype, card_name)
);

-- Head-to-head matchup win rates scraped from the mtgdecks winrates matrix.
-- One row per (archetype, opponent); opponent = 'Overall' holds the archetype's
-- aggregate win rate across all matchups. winrate is an integer percent (0..100).
CREATE TABLE IF NOT EXISTS metagame.archetype_matchup (
    archetype TEXT NOT NULL,
    opponent  TEXT NOT NULL,
    winrate   INT  NOT NULL,
    matches   INT  NOT NULL,
    PRIMARY KEY (archetype, opponent)
);

-- The big table: one row per (deck, card, board). Keys are the narrow surrogate
-- ints and board is a smallint (Board enum ordinal: 0 = mainboard, 1 = sideboard)
-- to keep it as small as possible — it dominates the database size.
CREATE TABLE IF NOT EXISTS metagame.deck_card (
    deck_id  INT NOT NULL REFERENCES metagame.deck(id),
    card_id  INT NOT NULL REFERENCES metagame.card(id),
    quantity SMALLINT NOT NULL,
    board    SMALLINT NOT NULL,
    PRIMARY KEY (deck_id, card_id, board)
);

-- Speeds up card-centric lookups that filter deck_card by card_id (and board):
-- co-occurrence (CardStatisticsService.getCooccurrences) and the deck "contains
-- card" filter (DeckQueryService.containmentClause). The PK is keyed on deck_id
-- first, so it can't serve these. Not covering on deck_id (kept out to stay small).
CREATE INDEX IF NOT EXISTS idx_deck_card_card_board ON metagame.deck_card (card_id, board);

-- Precomputed per-card play statistics. The card-statistics grid aggregates
-- deck_card across every deck (distinct-deck counts + average quantities), which
-- is expensive to do on each request. These aggregates don't depend on any of the
-- grid's filters, so we compute one row per card once and the grid just
-- filters/sorts/pages this small table. Populated by CardStatisticsService
-- .refreshStatistics() (POST /api/cards/statistics/refresh) after a deck sync.
-- Only cards that see play get a row; unplayed cards are absent and the grid's
-- left join treats them as zero.
CREATE TABLE IF NOT EXISTS metagame.card_play_stats (
    card_id           INT PRIMARY KEY REFERENCES metagame.card(id),
    mainboard_count   INT NOT NULL,
    sideboard_count   INT NOT NULL,
    avg_mainboard_qty DOUBLE PRECISION,
    avg_sideboard_qty DOUBLE PRECISION,
    avg_total_qty     DOUBLE PRECISION
);
