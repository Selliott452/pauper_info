package com.pauperinfo.deck

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface DeckRepository : JpaRepository<Deck, String> {

    @Modifying
    @Query(value = "INSERT INTO deck(id) VALUES (:id) ON CONFLICT DO NOTHING", nativeQuery = true)
    fun upsert(id: String)

    fun findAllByNameIsNull(): List<Deck>

    @Query("SELECT d.id FROM Deck d")
    fun findAllDeckIds(): List<String>

    @Query("SELECT d.id FROM Deck d WHERE d.name IS NULL")
    fun findIdsByNameIsNull(): List<String>
}
