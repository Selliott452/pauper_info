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
    KINDRED("Kindred"),
}
