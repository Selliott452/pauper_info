package com.pauperinfo.archetype

import kotlin.math.ln
import kotlin.math.sqrt

/**
 * Scores a deck's mainboard against each archetype profile.
 *
 * Each archetype is a vector of (card -> inclusion x IDF): inclusion makes the
 * archetype's staples matter most, IDF down-weights cards shared across many
 * archetypes (Lightning Bolt) so distinctive cards drive the match. A deck's
 * score for an archetype is the cosine similarity of its (binary) card set to
 * that weighted vector — presence of a signature card adds evidence; a missing
 * one is simply neutral, never disqualifying.
 */
class ArchetypeClassifier(rows: List<ArchetypeCard>, private val threshold: Double) {

    private val vocab: Set<String>
    private val weights: Map<String, Map<String, Double>>
    private val norms: Map<String, Double>

    init {
        // Drop the long fringe tail so profiles are their defining cards.
        val kept = rows.filter { it.inclusion >= INCLUSION_FLOOR }
        val byArchetype = kept.groupBy { it.archetype }

        // IDF over archetypes: a card in few archetype profiles is more telling.
        val docFreq = HashMap<String, Int>()
        byArchetype.values.forEach { cards ->
            cards.forEach { docFreq.merge(it.cardName, 1, Int::plus) }
        }
        val archetypeCount = byArchetype.size
        val idf = docFreq.mapValues { (_, df) -> ln((1.0 + archetypeCount) / (1.0 + df)) + 1.0 }

        weights = byArchetype.mapValues { (_, cards) ->
            cards.associate { it.cardName to it.inclusion * idf.getValue(it.cardName) }
        }
        norms = weights.mapValues { (_, w) -> sqrt(w.values.sumOf { it * it }) }
        vocab = idf.keys
    }

    /** Ranked (archetype, cosine score) for a deck's mainboard card names. */
    fun rank(mainboardCards: Collection<String>): List<Pair<String, Double>> {
        val relevant = mainboardCards.filter { it in vocab }
        if (relevant.isEmpty()) return emptyList()
        val deckNorm = sqrt(relevant.size.toDouble())

        return weights.mapNotNull { (archetype, w) ->
            var dot = 0.0
            for (card in relevant) w[card]?.let { dot += it }
            if (dot == 0.0) null else archetype to dot / (deckNorm * norms.getValue(archetype))
        }.sortedByDescending { it.second }
    }

    /** Best archetype, or null ("Other") if nothing clears the threshold. */
    fun classify(mainboardCards: Collection<String>): String? {
        val best = rank(mainboardCards).firstOrNull() ?: return null
        return if (best.second >= threshold) best.first else null
    }

    /**
     * Confidence in the top match from match strength (top score) plus the margin
     * over the runner-up. Null for an unmatched ("Other") deck.
     */
    fun confidence(ranked: List<Pair<String, Double>>): String? {
        val top = ranked.firstOrNull()?.second ?: return null
        if (top < threshold) return null
        val margin = top - (ranked.getOrNull(1)?.second ?: 0.0)
        // Both the absolute match and the lead over the runner-up matter — a close
        // runner-up means genuine ambiguity, so it lowers confidence at every tier.
        return when {
            top >= 0.45 && margin >= 0.12 -> "High"
            top >= 0.30 && margin >= 0.06 -> "Medium"
            else -> "Low"
        }
    }

    companion object {
        const val INCLUSION_FLOOR = 0.10f
    }
}
