package com.pauperinfo.controllers

import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.statistics.CardStatSort
import com.pauperinfo.card.statistics.CardStatistics
import com.pauperinfo.card.statistics.CardStatisticsService
import com.pauperinfo.card.statistics.SortDirection
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/cards")
class CardStatisticsController(private val cardStatisticsService: CardStatisticsService) {

    @GetMapping("/statistics")
    fun statistics(
        @RequestParam(required = false) colors: List<String>?,
        @RequestParam(required = false) names: List<String>?,
        @RequestParam(required = false) minMainboardDecks: Int?,
        @RequestParam(required = false) minSideboardDecks: Int?,
        @RequestParam(defaultValue = "MAINBOARD_DECK_COUNT") sortBy: CardStatSort,
        @RequestParam(defaultValue = "DESC") direction: SortDirection,
        @RequestParam(defaultValue = "100") limit: Int,
        @RequestParam(defaultValue = "0") offset: Int,
    ): List<CardStatistics> {
        return cardStatisticsService.getStatistics(
            colors = parseColors(colors),
            names = names,
            minMainboardDecks = minMainboardDecks,
            minSideboardDecks = minSideboardDecks,
            sortBy = sortBy,
            direction = direction,
            limit = limit,
            offset = offset,
        )
    }

    @GetMapping("/{name}/statistics")
    fun statisticsForCard(@PathVariable name: String): ResponseEntity<CardStatistics> {
        val stats = cardStatisticsService.getStatisticsForCardName(name)
        return if (stats != null) ResponseEntity.ok(stats) else ResponseEntity.notFound().build()
    }

    private fun parseColors(colors: List<String>?): List<Color>? = colors?.map { input ->
        Color.entries.firstOrNull { it.code.equals(input, ignoreCase = true) || it.name.equals(input, ignoreCase = true) }
            ?: throw IllegalArgumentException("Unknown color: $input")
    }
}
