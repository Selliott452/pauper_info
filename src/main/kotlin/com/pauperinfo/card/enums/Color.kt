package com.pauperinfo.card.enums

enum class Color(val code: String) {
    WHITE("W"),
    BLUE("U"),
    BLACK("B"),
    RED("R"),
    GREEN("G");

    companion object {
        // Resolves a request-supplied color, accepting either the single-letter
        // code ("U") or the enum name ("BLUE"), case-insensitively.
        fun fromInput(value: String): Color =
            entries.firstOrNull { it.code.equals(value, ignoreCase = true) || it.name.equals(value, ignoreCase = true) }
                ?: throw IllegalArgumentException("Unknown color: $value")
    }
}