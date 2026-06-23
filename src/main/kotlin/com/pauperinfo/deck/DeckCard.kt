package com.pauperinfo.deck

import jakarta.persistence.EnumType
import jakarta.persistence.Embeddable
import jakarta.persistence.Enumerated

@Embeddable
data class DeckCard(

    // Surrogate card id (card.id), not the Scryfall id.
    val cardId: Int,

    val quantity: Int,

    @Enumerated(EnumType.ORDINAL)
    val board: Board,
)
