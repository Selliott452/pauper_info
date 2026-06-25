package com.pauperinfo.archetype

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// Atomically swaps the scraped archetype data in short transactions. The slow
// mtgdecks HTTP scraping is done by the caller OUTSIDE these methods, so no DB
// connection (and no idle-in-transaction session) is held during network I/O -
// critical against a remote DB, which would otherwise drop the pinned connection
// or block on the table lock held across the multi-minute scrape.
@Service
class ArchetypePersistenceService(
    private val archetypeMatchupRepository: ArchetypeMatchupRepository,
    private val archetypeCardRepository: ArchetypeCardRepository,
) {

    @PersistenceContext
    private lateinit var entityManager: EntityManager

    @Transactional
    fun replaceMatchups(matchups: List<ArchetypeMatchup>) {
        archetypeMatchupRepository.deleteAllInBatch()
        persistAll(matchups)
    }

    @Transactional
    fun replaceArchetypeCards(rows: List<ArchetypeCard>) {
        archetypeCardRepository.deleteAllInBatch()
        persistAll(rows)
    }

    // These entities use assigned composite keys, so Spring Data's saveAll() would
    // treat each row as a possible update and fire a SELECT before every INSERT -
    // thousands of un-batched round trips against a remote DB. We just emptied the
    // table, so the rows are genuinely new: persist() inserts directly with no
    // existence check and batches under hibernate.jdbc.batch_size. flush/clear in
    // chunks keeps the persistence context from growing unbounded.
    private fun persistAll(entities: List<Any>) {
        entities.forEachIndexed { i, entity ->
            entityManager.persist(entity)
            if ((i + 1) % BATCH_SIZE == 0) {
                entityManager.flush()
                entityManager.clear()
            }
        }
    }

    companion object {
        private const val BATCH_SIZE = 100
    }
}
