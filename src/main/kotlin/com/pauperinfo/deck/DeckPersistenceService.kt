package com.pauperinfo.deck

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DeckPersistenceService(private val deckRepository: DeckRepository) {

    @Transactional
    fun saveNewDecks(ids: List<String>) {
        ids.forEach { deckRepository.upsert(it) }
    }
}
