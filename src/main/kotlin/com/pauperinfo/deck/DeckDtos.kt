package com.pauperinfo.deck

import com.pauperinfo.card.enums.Color
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.util.UUID

// Lightweight deck row for lists (decks-by-card, deck browser).
data class DeckSummary(

    val id: String,

    val name: String?,

    val author: String?,

    val colors: List<Color>,
)

// Full deck view: metadata header plus the resolved decklist.
data class DeckDetail(

    val id: String,

    val name: String?,

    val author: String?,

    val colors: List<Color>,

    val createdAt: OffsetDateTime?,

    val updatedAt: OffsetDateTime?,

    val mainboard: List<DeckCardEntry>,

    val sideboard: List<DeckCardEntry>,
)

// A card line in a decklist, with the card metadata needed to render it.
data class DeckCardEntry(

    val cardId: UUID,

    val name: String,

    val manaCost: String?,

    val cmc: BigDecimal,

    val typeLine: String,

    val colors: List<Color>,

    val imageUri: String?,

    val quantity: Int,
)
