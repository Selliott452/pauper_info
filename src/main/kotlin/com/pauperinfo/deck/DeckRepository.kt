package com.pauperinfo.deck

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface DeckRepository : JpaRepository<Deck, Int> {

    // Insert a batch of freshly-discovered decks by their Moxfield public ids
    // (details filled in later). The surrogate id is assigned by the database
    // (deck_id_seq default). The WHERE NOT EXISTS skips already-discovered ids
    // without evaluating the id default, so we don't burn sequence values (and
    // create id gaps) on duplicate discoveries; ON CONFLICT covers the rare race
    // between concurrent workers inserting the same new public_id. Inserting a
    // whole page in one statement (rather than row-by-row) keeps the lock window
    // short, which avoids the long lock-wait tail under concurrent sync workers.
    @Modifying
    @Query(
        value = "INSERT INTO metagame.deck(public_id) " +
            "SELECT v FROM unnest(cast(:publicIds as text[])) AS v " +
            "WHERE NOT EXISTS (SELECT 1 FROM metagame.deck d WHERE d.public_id = v) " +
            "ON CONFLICT (public_id) DO NOTHING",
        nativeQuery = true
    )
    fun insertNew(publicIds: Array<String>)

    fun findByPublicId(publicId: String): Deck?

    @Query("SELECT d.publicId FROM Deck d")
    fun findAllPublicIds(): List<String>

    @Query("SELECT d.publicId FROM Deck d WHERE d.name IS NULL")
    fun findPublicIdsByNameIsNull(): List<String>
}
