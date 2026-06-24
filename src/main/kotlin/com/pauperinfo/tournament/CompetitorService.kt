package com.pauperinfo.tournament

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

private fun round3(value: Double) = Math.round(value * 1000) / 1000.0

@Service
class CompetitorService(
    private val competitorRepository: CompetitorRepository,
    private val playerRepository: PlayerRepository,
    private val matchRepository: MatchRepository,
    private val swissService: SwissService,
) {

    @Transactional
    fun create(request: CreateCompetitorRequest): Competitor {
        val name = request.name.trim()
        if (name.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required")
        // Reuse an existing competitor with the same name rather than duplicating.
        return competitorRepository.findFirstByNameIgnoreCase(name)
            ?: competitorRepository.save(Competitor(name = name))
    }

    fun list(): List<CompetitorSummary> = competitorRepository.findAllByOrderByName().map { competitor ->
        val players = playerRepository.findByCompetitorId(competitor.id)
        val career = career(players)
        CompetitorSummary(
            id = competitor.id,
            name = competitor.name,
            events = players.size,
            wins = career.wins,
            losses = career.losses,
            draws = career.draws,
            matchWinPct = career.matchWinPct(),
            gameWinPct = career.gameWinPct(),
        )
    }

    fun get(id: Int): CompetitorDetail {
        val competitor = competitorRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such competitor")
        }
        val players = playerRepository.findByCompetitorId(id)
        val career = career(players)

        // Per-event finish: reuse the tournament's computed standings to read rank/record.
        val results = players.mapNotNull { player ->
            val detail = swissService.detail(player.eventId)
            val standing = detail.standings.firstOrNull { it.playerId == player.id } ?: return@mapNotNull null
            CompetitorEventResult(
                eventId = detail.id,
                eventName = detail.name,
                rank = standing.rank,
                players = detail.standings.size,
                wins = standing.wins,
                losses = standing.losses,
                draws = standing.draws,
            )
        }.sortedByDescending { it.eventId }

        return CompetitorDetail(
            id = competitor.id,
            name = competitor.name,
            events = players.size,
            wins = career.wins,
            losses = career.losses,
            draws = career.draws,
            matchWinPct = career.matchWinPct(),
            gameWinPct = career.gameWinPct(),
            results = results,
        )
    }

    // --- career aggregation across all of a competitor's matches --------------

    private class Career {
        var wins = 0
        var losses = 0
        var draws = 0
        var gamesWon = 0
        var gamesPlayed = 0
        fun matchesPlayed() = wins + losses + draws
        fun matchWinPct() = if (matchesPlayed() == 0) 0.0 else round3(wins.toDouble() / matchesPlayed())
        fun gameWinPct() = if (gamesPlayed == 0) 0.0 else round3(gamesWon.toDouble() / gamesPlayed)
    }

    private fun career(players: List<Player>): Career {
        val career = Career()
        if (players.isEmpty()) return career
        val playerIds = players.map { it.id }.toSet()
        for (m in matchRepository.findByPlayerIds(playerIds)) {
            if (!m.reported) continue
            val isPlayer1 = m.player1Id in playerIds
            if (m.player2Id == null) {
                // Bye (competitor is always player1 on a bye): a 2-0 win.
                career.wins++; career.gamesWon += 2; career.gamesPlayed += 2
                continue
            }
            val myWins = if (isPlayer1) m.player1Wins else m.player2Wins
            val oppWins = if (isPlayer1) m.player2Wins else m.player1Wins
            career.gamesWon += myWins
            career.gamesPlayed += myWins + oppWins + m.draws
            when {
                myWins > oppWins -> career.wins++
                myWins < oppWins -> career.losses++
                else -> career.draws++
            }
        }
        return career
    }

    private companion object {
        fun round3(value: Double) = Math.round(value * 1000) / 1000.0
    }
}
