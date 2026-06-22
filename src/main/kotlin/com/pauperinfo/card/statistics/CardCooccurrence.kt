package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.Color
import java.util.UUID

// Co-occurrence result for a target card: which other cards share its mainboard decks.
data class CardCooccurrence(

    val cardName: String,

    // Number of decks running the target card in the mainboard (the denominator).
    val deckCount: Long,

    val cooccurrences: List<CooccurringCard>,
)

data class CooccurringCard(

    val id: UUID,

    val name: String,

    val colors: List<Color>,

    // Number of those decks that also run this card in the mainboard.
    val deckCount: Long,
)
