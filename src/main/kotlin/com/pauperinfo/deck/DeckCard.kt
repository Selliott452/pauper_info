package com.pauperinfo.deck

import jakarta.persistence.Embeddable
import java.util.UUID

@Embeddable
data class DeckCard(

    val cardId: UUID,

    val quantity: Int,

    val board: String,
)
