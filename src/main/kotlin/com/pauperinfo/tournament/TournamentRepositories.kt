package com.pauperinfo.tournament

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CompetitorRepository : JpaRepository<Competitor, Int> {
    fun findAllByOrderByName(): List<Competitor>
    fun findFirstByNameIgnoreCase(name: String): Competitor?
}

interface EventRepository : JpaRepository<Event, Int> {
    fun findAllByOrderByCreatedAtDesc(): List<Event>
}

interface PlayerRepository : JpaRepository<Player, Int> {
    fun findByEventId(eventId: Int): List<Player>
    fun findByCompetitorId(competitorId: Int): List<Player>
}

interface RoundRepository : JpaRepository<Round, Int> {
    fun findByEventIdOrderByNumber(eventId: Int): List<Round>
}

interface MatchRepository : JpaRepository<Match, Int> {
    fun findByRoundIdIn(roundIds: Collection<Int>): List<Match>

    @Query("SELECT m FROM Match m WHERE m.player1Id IN :ids OR m.player2Id IN :ids")
    fun findByPlayerIds(@Param("ids") ids: Collection<Int>): List<Match>
}
