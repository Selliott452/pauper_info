package com.pauperinfo.controllers

import com.pauperinfo.card.enums.Color
import com.pauperinfo.deck.DeckDetail
import com.pauperinfo.deck.DeckQueryService
import com.pauperinfo.deck.DeckSummary
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/decks")
class DeckController(private val deckQueryService: DeckQueryService) {

    @GetMapping("/count")
    fun count(
        @RequestParam(required = false) colors: List<String>?,
        @RequestParam(defaultValue = "within") colorMatch: String,
        @RequestParam(required = false) author: String?,
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) archetypes: List<String>?,
        @RequestParam(required = false) confidences: List<String>?,
        @RequestParam(required = false) mainboardCards: List<String>?,
        @RequestParam(required = false) sideboardCards: List<String>?,
    ): Long = deckQueryService.countDecks(
        parseColors(colors), colorMatch == "exact", author, name, archetypes, confidences, mainboardCards, sideboardCards,
    )

    @GetMapping("/{id}")
    fun deck(@PathVariable id: String): ResponseEntity<DeckDetail> {
        val deck = deckQueryService.getDeck(id)
        return if (deck != null) ResponseEntity.ok(deck) else ResponseEntity.notFound().build()
    }

    @GetMapping
    fun list(
        @RequestParam(required = false) colors: List<String>?,
        @RequestParam(defaultValue = "within") colorMatch: String,
        @RequestParam(required = false) author: String?,
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) archetypes: List<String>?,
        @RequestParam(required = false) confidences: List<String>?,
        @RequestParam(required = false) mainboardCards: List<String>?,
        @RequestParam(required = false) sideboardCards: List<String>?,
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestParam(defaultValue = "0") offset: Int,
    ): List<DeckSummary> = deckQueryService.listDecks(
        parseColors(colors), colorMatch == "exact", author, name, archetypes, confidences, mainboardCards, sideboardCards, limit, offset,
    )

    private fun parseColors(colors: List<String>?): List<Color>? = colors?.map(Color::fromInput)
}
