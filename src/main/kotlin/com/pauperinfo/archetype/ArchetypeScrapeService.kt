package com.pauperinfo.archetype

import com.pauperinfo.card.repositories.CardRepository
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import java.util.Base64

@Service
class ArchetypeScrapeService(
    private val client: MtgDecksClient,
    private val archetypePersistenceService: ArchetypePersistenceService,
    private val cardRepository: CardRepository,
) {

    private val log = LoggerFactory.getLogger(ArchetypeScrapeService::class.java)

    // Not @Transactional: the multi-minute, rate-limited mtgdecks scraping below must
    // not hold a DB connection. Each delete+save swap runs in its own short
    // transaction via ArchetypePersistenceService.
    @Async
    fun scrape() {

        log.info("Scraping archetypes from mtgdecks")

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

        // The winrates page serves double duty: it lists every archetype (the slugs
        // we crawl for card profiles) and holds the head-to-head matchup matrix.
        val winratesDoc = Jsoup.parse(client.fetch("$BASE/Pauper/winrates"))

        val matchups = parseMatchups(winratesDoc)
        archetypePersistenceService.replaceMatchups(matchups)
        log.info("Stored ${matchups.size} archetype matchup rows")

        val archetypes = archetypeSlugs(winratesDoc)
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

        archetypePersistenceService.replaceArchetypeCards(rows)
        log.info("Stored ${rows.size} archetype-card rows across ${archetypes.size - failed} archetypes ($failed failed)")
    }

    // Display name -> slug, taken from the archetype links on the winrates matrix.
    private fun archetypeSlugs(doc: Document): Map<String, String> {
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

    // Parses the win-rate matrix (table#winrates) into (archetype vs opponent) rows.
    // Columns are [row-label, "Overall", opponent, opponent, ...]; each row's data
    // cells line up with the headers starting at index 1. Cells with no recorded
    // games are blank (no data-winrate) and are skipped. The "Overall" column is
    // kept as a matchup against the OVERALL pseudo-opponent (aggregate win rate).
    private fun parseMatchups(doc: Document): List<ArchetypeMatchup> {
        val table = doc.selectFirst("table#winrates") ?: return emptyList()
        val headers = table.select("thead th").map { it.text().trim() }

        val rows = mutableListOf<ArchetypeMatchup>()
        for (row in table.select("tbody tr.item")) {
            val archetype = row.attr("data-name").trim()
            if (archetype.isBlank()) continue
            row.select("td.winrate-cell").forEachIndexed { i, cell ->
                val opponent = headers.getOrNull(i + 1) ?: return@forEachIndexed
                val winrate = cell.attr("data-winrate").toIntOrNull() ?: return@forEachIndexed
                val matches = cell.selectFirst(".matches-number")?.text()
                    ?.replace(Regex("[^0-9]"), "")?.toIntOrNull() ?: 0
                rows.add(ArchetypeMatchup(archetype, opponent, winrate, matches))
            }
        }
        log.info("Found ${rows.size} matchups.")
        return rows
    }

    // mtgdecks hides nav targets in a base64 `goto` attribute (URL-safe or standard).
    private fun decodeGoto(value: String): String {
        val normalized = value.replace('-', '+').replace('_', '/')
        val padded = normalized + "=".repeat((4 - normalized.length % 4) % 4)
        return String(Base64.getDecoder().decode(padded))
    }

    companion object {
        // The win-rate matrix's "Overall" column: an archetype's aggregate win rate
        // across all matchups, stored as a matchup against this pseudo-opponent.
        const val OVERALL = "Overall"

        private const val BASE = "https://mtgdecks.net"
        private val ARCHETYPE_HREF = Regex("/Pauper/([a-z0-9-]+)")
        private val NON_ARCHETYPE_SLUGS = setOf(
            "winrates", "staples", "budget-decks", "metagame", "decklists",
            "banned-decks", "banned", "tournaments", "articles",
        )
    }
}
