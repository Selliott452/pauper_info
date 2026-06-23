CREATE TABLE IF NOT EXISTS card (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    mana_cost TEXT,
    cmc NUMERIC NOT NULL,
    type_line TEXT NOT NULL,
    oracle_text TEXT,
    power TEXT,
    toughness TEXT,
    colors TEXT[],
    rarity TEXT NOT NULL,
    set_code TEXT NOT NULL,
    image_uri TEXT,
    back_image_uri TEXT
);

CREATE TABLE IF NOT EXISTS card_legality (
    card_id UUID NOT NULL REFERENCES card(id),
    format TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (card_id, format)
);

CREATE TABLE IF NOT EXISTS deck (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    author      TEXT,
    colors      TEXT[],
    created_at  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ,
    archetype   TEXT,
    archetype_confidence TEXT
);

ALTER TABLE deck ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE deck ADD COLUMN IF NOT EXISTS archetype_confidence TEXT;

-- Per-archetype card profiles scraped from mtgdecks (maindeck inclusion rates).
-- These drive the archetype classifier.
CREATE TABLE IF NOT EXISTS archetype_card (
    archetype TEXT NOT NULL,
    card_name TEXT NOT NULL,
    inclusion REAL NOT NULL,
    PRIMARY KEY (archetype, card_name)
);

-- Head-to-head matchup win rates scraped from the mtgdecks winrates matrix.
-- One row per (archetype, opponent); opponent = 'Overall' holds the archetype's
-- aggregate win rate across all matchups. winrate is an integer percent (0..100).
CREATE TABLE IF NOT EXISTS archetype_matchup (
    archetype TEXT NOT NULL,
    opponent  TEXT NOT NULL,
    winrate   INT  NOT NULL,
    matches   INT  NOT NULL,
    PRIMARY KEY (archetype, opponent)
);

CREATE TABLE IF NOT EXISTS deck_card (
    deck_id  TEXT NOT NULL REFERENCES deck(id),
    card_id  UUID NOT NULL,
    quantity INT  NOT NULL,
    board    TEXT NOT NULL,
    PRIMARY KEY (deck_id, card_id, board)
);

-- Speeds up card-centric lookups that filter deck_card by card_id (and board):
-- co-occurrence (CardStatisticsService.getCooccurrences) and the deck "contains
-- card" filter (DeckQueryService.containmentClause). The PK is keyed on deck_id
-- first, so it can't serve these.
--
-- Indexed on (card_id, board) only — deliberately NOT covering on deck_id. There
-- are few distinct card_ids over millions of rows, so B-tree deduplication keeps
-- this tiny (~27 MB); adding the near-unique deck_id defeats dedup and bloated it
-- ~18x. Queries fetch deck_id from the heap, which is cheap given card_id is
-- selective. (Drops the old idx_deck_card_card_board_deck if present.)
DROP INDEX IF EXISTS idx_deck_card_card_board_deck;
CREATE INDEX IF NOT EXISTS idx_deck_card_card_board ON deck_card (card_id, board);

-- Precomputed per-card play statistics. The card-statistics grid aggregates
-- deck_card across every deck (distinct-deck counts + average quantities), which
-- is expensive to do on each request. These aggregates don't depend on any of the
-- grid's filters, so we compute one row per card once and the grid just
-- filters/sorts/pages this small table. Populated by CardStatisticsService
-- .refreshStatistics() (POST /api/cards/statistics/refresh) after a deck sync.
-- Only cards that see play get a row; unplayed cards are absent and the grid's
-- left join treats them as zero.
CREATE TABLE IF NOT EXISTS card_play_stats (
    card_id           UUID PRIMARY KEY,
    mainboard_count   INT NOT NULL,
    sideboard_count   INT NOT NULL,
    avg_mainboard_qty DOUBLE PRECISION,
    avg_sideboard_qty DOUBLE PRECISION,
    avg_total_qty     DOUBLE PRECISION
);
