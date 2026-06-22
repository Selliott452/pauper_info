package com.pauperinfo.card.repositories

import com.pauperinfo.card.Card
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface CardRepository : JpaRepository<Card, UUID> {
    fun findByName(name: String): Card?

    @Query("SELECT c.name FROM Card c ORDER BY c.name")
    fun findAllNames(): List<String>
}