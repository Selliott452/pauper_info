package com.pauperinfo.archetype

import com.pauperinfo.card.repositories.CardRepository
import org.jsoup.Jsoup
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Base64

@Service
class ArchetypeScrapeService(
    private val client: MtgDecksClient,
    private val archetypeCardRepository: ArchetypeCardRepository,
    private val cardRepository: CardRepository,
) {

    private val log = LoggerFactory.getLogger(ArchetypeScrapeService::class.java)

    @Async
    @Transactional
    fun scrape() {
        // mtgdecks lists double-faced cards by their front-face name ("Delver of
        // Secrets"), but our decks/cards use the full Scryfall name ("Delver of
        // Secrets // Insectile Aberration"). Map front-face -> canonical so profile
        // cards match deck cards during classification.
        val nameMap = HashMap<String, String>()
        cardRepository.findAllNames().forEach { full ->
            nameMap[full] = full
            val front = full.substringBefore(" // ")
            if (front != full) nameMap.putIfAbsent(front, full)
        }

        val archetypes = archetypeSlugs()
        log.info("Scraping ${archetypes.size} archetype profiles from mtgdecks")

        val rows = mutableListOf<ArchetypeCard>()
        var done = 0
        var failed = 0
        for ((slug, name) in archetypes) {
            try {
                fetchProfile(slug, nameMap).forEach { (card, inclusion) ->
                    rows.add(ArchetypeCard(name, card, inclusion))
                }
            } catch (e: Exception) {
                failed++
                log.warn("Failed to scrape profile for $slug: ${e.message}")
            }
            if (++done % 20 == 0) log.info("Profiles: $done/${archetypes.size}")
        }

        archetypeCardRepository.deleteAllInBatch()
        archetypeCardRepository.saveAll(rows)
        log.info("Stored ${rows.size} archetype-card rows across ${archetypes.size - failed} archetypes ($failed failed)")
    }

    // Display name -> slug, taken from the archetype links on the winrates matrix.
    private fun archetypeSlugs(): Map<String, String> {
        val doc = Jsoup.parse(client.fetch("$BASE/Pauper/winrates"))
        val bySlug = LinkedHashMap<String, String>()
        for (a in doc.select("a[href]")) {
            val href = a.attr("href")
            // Archetype links look like /Pauper/<slug> with no further path segments.
            val match = ARCHETYPE_HREF.matchEntire(href) ?: continue
            val slug = match.groupValues[1]
            if (slug in NON_ARCHETYPE_SLUGS) continue
            val name = a.text().trim()
            if (name.isNotBlank()) bySlug.putIfAbsent(slug, name)
        }
        return bySlug.entries.associate { (slug, name) -> slug to name }
    }

    // Returns card name -> maindeck inclusion fraction (0..1) for one archetype.
    // Names are normalized to canonical (full DFC) names via nameMap so they match
    // deck cards; if two scraped names map to the same canonical, keep the max.
    private fun fetchProfile(slug: String, nameMap: Map<String, String>): Map<String, Float> {
        val archetypePage = client.fetch("$BASE/Pauper/$slug")
        val analysisPath = Jsoup.parse(archetypePage).select("[goto]")
            .map { decodeGoto(it.attr("goto")) }
            .firstOrNull { it.contains("-analysis-") && it.endsWith("/all") }
            ?: throw RuntimeException("no analysis link found")

        val analysisHtml = client.fetch("$BASE$analysisPath")
        // Everything before the "Sideboard Cards" section is maindeck.
        val maindeck = Jsoup.parse(analysisHtml.substringBefore("Sideboard Cards"))

        val profile = LinkedHashMap<String, Float>()
        for (row in maindeck.select("tr.cardItem")) {
            val name = row.selectFirst("td.number a")?.text()?.trim() ?: continue
            val pct = row.selectFirst("td.number")?.nextElementSibling()?.text()?.trim() ?: continue
            val inclusion = (pct.removeSuffix("%").toFloatOrNull() ?: continue) / 100f
            val canonical = nameMap[name] ?: name
            profile.merge(canonical, inclusion) { a, b -> maxOf(a, b) }
        }
        return profile
    }

    // mtgdecks hides nav targets in a base64 `goto` attribute (URL-safe or standard).
    private fun decodeGoto(value: String): String {
        val normalized = value.replace('-', '+').replace('_', '/')
        val padded = normalized + "=".repeat((4 - normalized.length % 4) % 4)
        return String(Base64.getDecoder().decode(padded))
    }

    companion object {
        private const val BASE = "https://mtgdecks.net"
        private val ARCHETYPE_HREF = Regex("/Pauper/([a-z0-9-]+)")
        private val NON_ARCHETYPE_SLUGS = setOf(
            "winrates", "staples", "budget-decks", "metagame", "decklists",
            "banned-decks", "banned", "tournaments", "articles",
        )
    }
}
