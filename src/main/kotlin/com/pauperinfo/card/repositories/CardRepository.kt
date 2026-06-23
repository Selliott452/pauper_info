package com.pauperinfo.card.repositories

import com.pauperinfo.card.Card
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import java.util.UUID

interface CardRepository : JpaRepository<Card, Int> {
    fun findByName(name: String): Card?

    // Used by the Scryfall sync to dedupe by external id (cards are keyed on a
    // surrogate, so incoming Scryfall ids are matched against scryfall_id).
    fun findByScryfallIdIn(scryfallIds: Collection<UUID>): List<Card>

    @Query("SELECT c.name FROM Card c ORDER BY c.name")
    fun findAllNames(): List<String>
}
