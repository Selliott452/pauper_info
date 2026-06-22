package com.pauperinfo.controllers

import com.pauperinfo.card.enums.CardType
import com.pauperinfo.card.enums.Color
import com.pauperinfo.card.statistics.CardCooccurrence
import com.pauperinfo.card.statistics.CardDetail
import com.pauperinfo.card.statistics.CardGraph
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
        @RequestParam(required = false) types: List<String>?,
        @RequestParam(required = false) minMainboardDecks: Int?,
        @RequestParam(required = false) minSideboardDecks: Int?,
        @RequestParam(defaultValue = "MAINBOARD_DECK_COUNT") sortBy: CardStatSort,
        @RequestParam(defaultValue = "DESC") direction: SortDirection,
        @RequestParam(defaultValue = "100") limit: Int,
        @RequestParam(defaultValue = "0") offset: Int,
    ): List<CardStatistics> {
        // "C" / "COLORLESS" is a distinct filter value, not a Color enum member.
        val includeColorless = colors?.any { it.equals("C", ignoreCase = true) || it.equals("COLORLESS", ignoreCase = true) } ?: false
        val coloredFilters = colors?.filterNot { it.equals("C", ignoreCase = true) || it.equals("COLORLESS", ignoreCase = true) }

        return cardStatisticsService.getStatistics(
            colors = parseColors(coloredFilters),
            includeColorless = includeColorless,
            names = names,
            types = parseTypes(types),
            minMainboardDecks = minMainboardDecks,
            minSideboardDecks = minSideboardDecks,
            sortBy = sortBy,
            direction = direction,
            limit = limit,
            offset = offset,
        )
    }

    @GetMapping("/graph")
    fun graph(
        @RequestParam(defaultValue = "120") topCards: Int,
        @RequestParam(defaultValue = "200") minShared: Int,
    ): CardGraph = cardStatisticsService.getGraph(topCards, minShared)

    @GetMapping("/{name}/statistics")
    fun statisticsForCard(@PathVariable name: String): ResponseEntity<CardStatistics> {
        val stats = cardStatisticsService.getStatisticsForCardName(name)
        return if (stats != null) ResponseEntity.ok(stats) else ResponseEntity.notFound().build()
    }

    @GetMapping("/{name}")
    fun cardDetail(@PathVariable name: String): ResponseEntity<CardDetail> {
        val detail = cardStatisticsService.getCardDetail(name)
        return if (detail != null) ResponseEntity.ok(detail) else ResponseEntity.notFound().build()
    }

    @GetMapping("/{name}/cooccurrences")
    fun cooccurrences(
        @PathVariable name: String,
        @RequestParam(defaultValue = "50") limit: Int,
    ): ResponseEntity<CardCooccurrence> {
        val result = cardStatisticsService.getCooccurrences(name, limit)
        return if (result != null) ResponseEntity.ok(result) else ResponseEntity.notFound().build()
    }

    private fun parseColors(colors: List<String>?): List<Color>? = colors?.map { input ->
        Color.entries.firstOrNull { it.code.equals(input, ignoreCase = true) || it.name.equals(input, ignoreCase = true) }
            ?: throw IllegalArgumentException("Unknown color: $input")
    }

    private fun parseTypes(types: List<String>?): List<CardType>? = types?.map { input ->
        CardType.entries.firstOrNull { it.label.equals(input, ignoreCase = true) || it.name.equals(input, ignoreCase = true) }
            ?: throw IllegalArgumentException("Unknown type: $input")
    }
}
