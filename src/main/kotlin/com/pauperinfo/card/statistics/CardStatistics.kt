package com.pauperinfo.card.statistics

import com.pauperinfo.card.enums.Color
import java.util.UUID

data class CardStatistics(

    val id: UUID,

    val name: String,

    val colors: List<Color>,

    val mainboardDeckCount: Long,

    val sideboardDeckCount: Long,

    val avgMainboardQuantity: Double?,

    val avgSideboardQuantity: Double?,

    val avgTotalQuantity: Double?,
)

enum class CardStatSort(val column: String) {
    NAME("c.name"),
    MAINBOARD_DECK_COUNT("mainboard_count"),
    SIDEBOARD_DECK_COUNT("sideboard_count"),
    AVG_MAINBOARD_QUANTITY("avg_mainboard_qty"),
    AVG_SIDEBOARD_QUANTITY("avg_sideboard_qty"),
    AVG_TOTAL_QUANTITY("avg_total_qty"),
}

enum class SortDirection {
    ASC,
    DESC,
}
