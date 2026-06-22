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
    image_uri TEXT
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
    updated_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deck_card (
    deck_id  TEXT NOT NULL REFERENCES deck(id),
    card_id  UUID NOT NULL,
    quantity INT  NOT NULL,
    board    TEXT NOT NULL,
    PRIMARY KEY (deck_id, card_id, board)
);

-- Speeds up card-centric lookups: statistics aggregation, co-occurrence, and the
-- graph self-join all filter deck_card by card_id (and board). The PK is keyed on
-- deck_id first, so it can't serve these.
CREATE INDEX IF NOT EXISTS idx_deck_card_card_board_deck ON deck_card (card_id, board, deck_id);
