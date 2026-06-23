package com.pauperinfo.deck

// Which board a deck_card row belongs to. Stored as the enum ordinal in a smallint
// column (0 = MAINBOARD, 1 = SIDEBOARD) to keep the large deck_card table narrow.
// Native queries reference these ordinals directly (see Board.MAINBOARD.ordinal).
enum class Board {
    MAINBOARD,
    SIDEBOARD,
}
