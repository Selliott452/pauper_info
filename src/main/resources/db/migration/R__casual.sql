-- Casual 1-on-1 match tracking. Fully isolated in its own schema — a separate
-- player list and match log, unrelated to the tournament or metagame tables.
CREATE SCHEMA IF NOT EXISTS casual;

CREATE TABLE IF NOT EXISTS casual.player (
    id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One head-to-head match: a best-of-N game score plus an optional archetype per
-- side and the day it was played.
CREATE TABLE IF NOT EXISTS casual.match (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player1_id        INT NOT NULL REFERENCES casual.player(id) ON DELETE CASCADE,
    player2_id        INT NOT NULL REFERENCES casual.player(id) ON DELETE CASCADE,
    player1_wins      SMALLINT NOT NULL DEFAULT 0,
    player2_wins      SMALLINT NOT NULL DEFAULT 0,
    draws             SMALLINT NOT NULL DEFAULT 0,
    player1_archetype TEXT,
    player2_archetype TEXT,
    player1_deck_url  TEXT,
    player2_deck_url  TEXT,
    played_on         DATE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE casual.match ADD COLUMN IF NOT EXISTS player1_deck_url TEXT;
ALTER TABLE casual.match ADD COLUMN IF NOT EXISTS player2_deck_url TEXT;

CREATE INDEX IF NOT EXISTS idx_casual_match_p1 ON casual.match (player1_id);
CREATE INDEX IF NOT EXISTS idx_casual_match_p2 ON casual.match (player2_id);
