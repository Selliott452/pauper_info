package com.pauperinfo.casual

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface CasualPlayerRepository : JpaRepository<CasualPlayer, Int> {
    fun findAllByOrderByName(): List<CasualPlayer>
    fun findFirstByNameIgnoreCase(name: String): CasualPlayer?
}

interface CasualMatchRepository : JpaRepository<CasualMatch, Int> {
    fun findAllByOrderByCreatedAtDesc(): List<CasualMatch>

    @Query("SELECT m FROM CasualMatch m WHERE m.player1Id = :id OR m.player2Id = :id")
    fun findByPlayerId(@Param("id") id: Int): List<CasualMatch>
}
