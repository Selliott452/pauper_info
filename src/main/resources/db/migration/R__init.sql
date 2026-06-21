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
