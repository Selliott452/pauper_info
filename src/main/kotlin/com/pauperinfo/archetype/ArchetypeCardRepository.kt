package com.pauperinfo.archetype

import org.springframework.data.jpa.repository.JpaRepository

interface ArchetypeCardRepository : JpaRepository<ArchetypeCard, ArchetypeCardId> {
    fun findByArchetypeOrderByInclusionDesc(archetype: String): List<ArchetypeCard>

    // Which archetype profiles include this card (most-central first).
    fun findByCardNameOrderByInclusionDesc(cardName: String): List<ArchetypeCard>
}
