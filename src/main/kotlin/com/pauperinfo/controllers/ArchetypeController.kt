package com.pauperinfo.controllers

import com.pauperinfo.archetype.ArchetypeClassificationService
import com.pauperinfo.archetype.ArchetypeDetail
import com.pauperinfo.archetype.ArchetypeQueryService
import com.pauperinfo.archetype.ArchetypeScore
import com.pauperinfo.archetype.ArchetypeMatchupWeight
import com.pauperinfo.archetype.ArchetypeScrapeService
import com.pauperinfo.archetype.ArchetypeSummary
import com.pauperinfo.archetype.CardArchetype
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/archetypes")
class ArchetypeController(
    private val archetypeScrapeService: ArchetypeScrapeService,
    private val classificationService: ArchetypeClassificationService,
    private val archetypeQueryService: ArchetypeQueryService,
) {

    @GetMapping
    fun list(): List<ArchetypeSummary> = archetypeQueryService.list()

    @GetMapping("/{name}")
    fun detail(@PathVariable name: String): ResponseEntity<ArchetypeDetail> {
        val detail = archetypeQueryService.get(name)
        return if (detail != null) ResponseEntity.ok(detail) else ResponseEntity.notFound().build()
    }

    // Per-opponent matchups for an archetype from one source (global/tournament/casual).
    @GetMapping("/{name}/matchups")
    fun matchups(
        @PathVariable name: String,
        @RequestParam(defaultValue = "global") source: String,
    ): List<ArchetypeMatchupWeight> = archetypeQueryService.matchupsFor(name, source)

    // Archetypes a given card belongs to (for the card detail page).
    @GetMapping("/by-card/{name}")
    fun byCard(@PathVariable name: String): List<CardArchetype> =
        archetypeQueryService.archetypesForCard(name)

    @PostMapping("/scrape")
    fun scrape(): ResponseEntity<String> {
        archetypeScrapeService.scrape()
        return ResponseEntity.accepted().body("Archetype profile scrape started")
    }

    @PostMapping("/classify")
    fun classify(@RequestParam(defaultValue = "0.15") threshold: Double): ResponseEntity<String> {
        classificationService.classifyAll(threshold)
        return ResponseEntity.accepted().body("Archetype classification started (threshold=$threshold)")
    }

    // Debug: see how a specific deck scores against each archetype.
    @GetMapping("/rank/{deckId}")
    fun rank(
        @PathVariable deckId: String,
        @RequestParam(defaultValue = "8") limit: Int,
    ): List<ArchetypeScore> = classificationService.rankForDeck(deckId, limit)
}
