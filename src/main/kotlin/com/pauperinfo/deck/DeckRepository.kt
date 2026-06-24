package com.pauperinfo.deck

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface DeckRepository : JpaRepository<Deck, Int> {

    // Insert a freshly-discovered deck by its Moxfield public id (details filled in
    // later). The surrogate id is assigned by the database.
    @Modifying
    @Query(value = "INSERT INTO metagame.deck(public_id) VALUES (:publicId) ON CONFLICT DO NOTHING", nativeQuery = true)
    fun upsert(publicId: String)

    fun findByPublicId(publicId: String): Deck?

    @Query("SELECT d.publicId FROM Deck d")
    fun findAllPublicIds(): List<String>

    @Query("SELECT d.publicId FROM Deck d WHERE d.name IS NULL")
    fun findPublicIdsByNameIsNull(): List<String>
}
