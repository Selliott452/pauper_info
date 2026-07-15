package com.pauperinfo.casual

import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime

// Casual 1-on-1 match tracking. Self-contained in the "casual" schema with no
// references to the tournament or metagame tables.

@Entity
@Table(name = "player", schema = "casual")
class CasualPlayer(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    var name: String,

    @Column(name = "created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
)

@Entity
@Table(name = "match", schema = "casual")
class CasualMatch(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Int = 0,

    @Column(name = "player1_id")
    var player1Id: Int,

    @Column(name = "player2_id")
    var player2Id: Int,

    @Column(name = "player1_wins")
    var player1Wins: Int = 0,

    @Column(name = "player2_wins")
    var player2Wins: Int = 0,

    var draws: Int = 0,

    @Column(name = "player1_archetype")
    var player1Archetype: String? = null,

    @Column(name = "player2_archetype")
    var player2Archetype: String? = null,

    @Column(name = "player1_deck_url")
    var player1DeckUrl: String? = null,

    @Column(name = "player2_deck_url")
    var player2DeckUrl: String? = null,

    @Column(name = "played_on")
    var playedOn: LocalDate? = null,

    var notes: String? = null,

    @Column(name = "created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
)
