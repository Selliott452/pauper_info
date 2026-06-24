package com.pauperinfo.tournament

import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime

// Swiss tournament domain. Entirely self-contained in the "tournament" schema with
// no references to the cards/decks/archetypes (public) tables.

// A persistent competitor (person). Lives independently of tournaments; player
// rows link to it so results aggregate into a career record.
@Entity
@Table(name = "competitor", schema = "tournament")
class Competitor(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    var name: String,

    @Column(name = "created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
)

@Entity
@Table(name = "event", schema = "tournament")
class Event(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    var name: String,

    // SETUP, ACTIVE, or COMPLETE.
    var status: String,

    // The day the tournament was played (user-editable), distinct from createdAt.
    @Column(name = "event_date")
    var eventDate: LocalDate? = null,

    @Column(name = "created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
)

@Entity
@Table(name = "player", schema = "tournament")
class Player(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    @Column(name = "event_id")
    val eventId: Int,

    // The persistent competitor this participation belongs to.
    @Column(name = "competitor_id")
    val competitorId: Int? = null,

    var name: String,

    // What this player ran in this event: a free-text archetype and an optional
    // deck link (e.g. Moxfield).
    var archetype: String? = null,

    @Column(name = "deck_url")
    var deckUrl: String? = null,

    // Dropped players are no longer paired, but their played matches still count
    // toward opponents' tiebreakers.
    var dropped: Boolean = false,
)

@Entity
@Table(name = "round", schema = "tournament")
class Round(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    @Column(name = "event_id")
    val eventId: Int,

    // Mutable so rounds can be re-sequenced when one is deleted.
    var number: Int,
)

@Entity
@Table(name = "match", schema = "tournament")
class Match(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    @Column(name = "round_id")
    val roundId: Int,

    @Column(name = "player1_id")
    val player1Id: Int,

    // Null means player1 has a bye.
    @Column(name = "player2_id")
    val player2Id: Int? = null,

    @Column(name = "player1_wins")
    var player1Wins: Int = 0,

    @Column(name = "player2_wins")
    var player2Wins: Int = 0,

    var draws: Int = 0,

    var reported: Boolean = false,
)
