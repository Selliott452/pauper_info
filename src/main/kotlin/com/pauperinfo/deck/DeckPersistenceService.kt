package com.pauperinfo.deck

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DeckPersistenceService(private val deckRepository: DeckRepository) {

    @Transactional
    fun saveNewDecks(ids: List<String>) {
        val existing = deckRepository.findAllById(ids).map { it.id }.toSet()
        val newDecks = ids.filter { it !in existing }.map { Deck(it) }
        deckRepository.saveAll(newDecks)
    }
}
