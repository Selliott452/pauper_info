package com.pauperinfo.deck

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface DeckRepository : JpaRepository<Deck, Int> {

    // Insert a freshly-discovered deck by its Moxfield public id (details filled in
    // later). The surrogate id is assigned by the database (deck_id_seq default).
    // The WHERE NOT EXISTS skips the common "already discovered" case without
    // evaluating the id default, so we don't burn sequence values (and create id
    // gaps) on the many duplicate discoveries; ON CONFLICT covers the rare race
    // between concurrent workers inserting the same new public_id.
    @Modifying
    @Query(
        value = "INSERT INTO metagame.deck(public_id) " +
            "SELECT :publicId " +
            "WHERE NOT EXISTS (SELECT 1 FROM metagame.deck WHERE public_id = :publicId) " +
            "ON CONFLICT (public_id) DO NOTHING",
        nativeQuery = true
    )
    fun upsert(publicId: String)

    fun findByPublicId(publicId: String): Deck?

    @Query("SELECT d.publicId FROM Deck d")
    fun findAllPublicIds(): List<String>

    @Query("SELECT d.publicId FROM Deck d WHERE d.name IS NULL")
    fun findPublicIdsByNameIsNull(): List<String>
}
