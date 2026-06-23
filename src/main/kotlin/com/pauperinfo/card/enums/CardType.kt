package com.pauperinfo.card.enums

// label is how the type appears in a Scryfall type line (e.g. "Artifact Creature — Construct").
enum class CardType(val label: String) {
    CREATURE("Creature"),
    INSTANT("Instant"),
    SORCERY("Sorcery"),
    ARTIFACT("Artifact"),
    ENCHANTMENT("Enchantment"),
    LAND("Land"),
    PLANESWALKER("Planeswalker"),
    BATTLE("Battle"),
    KINDRED("Kindred");

    companion object {
        // Resolves a request-supplied type, accepting either the label ("Creature")
        // or the enum name ("CREATURE"), case-insensitively.
        fun fromInput(value: String): CardType =
            entries.firstOrNull { it.label.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: throw IllegalArgumentException("Unknown type: $value")
    }
}
