package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime

@Service
class DeckPersistenceService(private val deckRepository: DeckRepository) {

    @Transactional
    fun saveNewDecks(ids: List<String>) {
        if (ids.isEmpty()) return
        deckRepository.insertNew(ids.toTypedArray())
    }

    // Persist fetched deck details in a single short transaction. The caller does the
    // slow Moxfield HTTP fetch and card mapping OUTSIDE this method, so no DB
    // connection is held during network I/O - important against a remote DB, where
    // pinning a connection (and an idle-in-transaction session) across the fetch
    // would exhaust the pool and risk the provider killing the session.
    //
    // Reuses the surrogate id assigned during discovery so we update in place rather
    // than violating the public_id unique constraint.
    @Transactional
    fun saveDeckDetail(
        publicId: String,
        name: String?,
        author: String?,
        colors: Array<Color>,
        createdAt: OffsetDateTime,
        updatedAt: OffsetDateTime,
        cards: List<DeckCard>,
    ) {
        val existingId = deckRepository.findByPublicId(publicId)?.id ?: 0
        deckRepository.save(
            Deck(
                id = existingId,
                publicId = publicId,
                name = name,
                author = author,
                colors = colors,
                createdAt = createdAt,
                updatedAt = updatedAt,
                cards = cards,
            )
        )
    }

    @Transactional
    fun deleteByPublicId(publicId: String) {
        deckRepository.findByPublicId(publicId)?.let { deckRepository.delete(it) }
    }
}
