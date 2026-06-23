package com.pauperinfo.archetype

import org.springframework.data.jpa.repository.JpaRepository

interface ArchetypeMatchupRepository : JpaRepository<ArchetypeMatchup, ArchetypeMatchupId> {
    fun findByArchetypeOrderByMatchesDesc(archetype: String): List<ArchetypeMatchup>
}
