package com.pauperinfo.moxfield

// Pauper legality check against the full Moxfield deck response (which carries
// every card's legalities, type line, and oracle text — including cards we don't
// store, so this is accurate where our card table alone would not be).
object DeckLegality {

    private const val MIN_MAINBOARD = 60

    fun isPauperLegal(detail: MoxfieldDeckDetailResponse): Boolean {
        val entries = detail.boards.mainboard.cards.values + detail.boards.sideboard.cards.values

        // Every card must be pauper-legal (not banned / not legal -> illegal).
        if (entries.any { it.card.legalities["pauper"] != "legal" }) return false

        // 4-copy rule: total copies across both boards, per card name. Basic lands
        // and "A deck can have any number…" cards are exempt.
        val totalByName = HashMap<String, Int>()
        val cardByName = HashMap<String, MoxfieldCardRef>()
        for (entry in entries) {
            totalByName.merge(entry.card.name, entry.quantity, Int::plus)
            cardByName.putIfAbsent(entry.card.name, entry.card)
        }
        for ((name, total) in totalByName) {
            if (total > 4 && !allowsAnyNumber(cardByName.getValue(name))) return false
        }

        // Deck-size minimum.
        val mainboard = detail.boards.mainboard.cards.values.sumOf { it.quantity }
        return mainboard >= MIN_MAINBOARD
    }

    private fun allowsAnyNumber(card: MoxfieldCardRef): Boolean {
        val typeLine = card.typeLine ?: ""
        val isBasicLand = typeLine.contains("Basic") && typeLine.contains("Land")
        val anyNumber = card.oracleText?.contains("A deck can have") == true
        return isBasicLand || anyNumber
    }
}
