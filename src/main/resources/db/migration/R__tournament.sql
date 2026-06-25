-- Swiss tournament manager. Deliberately isolated in its own schema with no
-- references to the public (cards/decks/archetypes) tables — the two features
-- share nothing in the database.
CREATE SCHEMA IF NOT EXISTS tournament;

-- A persistent competitor (a person), independent of any tournament. Tournament
-- participants (player rows) link here so stats roll up across events.
CREATE TABLE IF NOT EXISTS tournament.competitor (
    id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A tournament. status: SETUP (adding players), ACTIVE (rounds underway), COMPLETE.
-- event_date is the day it was played (distinct from created_at, the row's insert time).
-- Rounds run until the organizer marks the event complete (no fixed round count).
CREATE TABLE IF NOT EXISTS tournament.event (
    id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL,
    status     TEXT NOT NULL,
    event_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One competitor's participation in one tournament. name is a snapshot of the
-- competitor's name at the time (so display doesn't depend on a join).
-- archetype / deck_url record what this player ran in this event (free-text
-- archetype name and an optional Moxfield link).
CREATE TABLE IF NOT EXISTS tournament.player (
    id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id      INT NOT NULL REFERENCES tournament.event(id) ON DELETE CASCADE,
    competitor_id INT REFERENCES tournament.competitor(id),
    name          TEXT NOT NULL,
    archetype     TEXT,
    deck_url      TEXT,
    dropped       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS tournament.round (
    id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id INT NOT NULL REFERENCES tournament.event(id) ON DELETE CASCADE,
    number   INT NOT NULL
);

-- One pairing. player2_id NULL means player1 has a bye (counts as a 2-0 win).
-- Results are game wins per player plus draws; reported flips true once entered.
CREATE TABLE IF NOT EXISTS tournament.match (
    id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_id     INT NOT NULL REFERENCES tournament.round(id) ON DELETE CASCADE,
    player1_id   INT NOT NULL REFERENCES tournament.player(id) ON DELETE CASCADE,
    player2_id   INT REFERENCES tournament.player(id) ON DELETE CASCADE,
    player1_wins INT NOT NULL DEFAULT 0,
    player2_wins INT NOT NULL DEFAULT 0,
    draws        INT NOT NULL DEFAULT 0,
    reported     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_tournament_player_event ON tournament.player (event_id);
CREATE INDEX IF NOT EXISTS idx_tournament_round_event ON tournament.round (event_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_round ON tournament.match (round_id);
