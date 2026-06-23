package com.pauperinfo.archetype

import org.springframework.data.jpa.repository.JpaRepository

interface ArchetypeCardRepository : JpaRepository<ArchetypeCard, ArchetypeCardId> {
    fun findByArchetypeOrderByInclusionDesc(archetype: String): List<ArchetypeCard>
}
