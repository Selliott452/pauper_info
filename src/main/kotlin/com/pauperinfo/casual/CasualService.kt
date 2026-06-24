package com.pauperinfo.casual

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.LocalDate

private fun round3(value: Double) = Math.round(value * 1000) / 1000.0

@Service
class CasualService(
    private val playerRepository: CasualPlayerRepository,
    private val matchRepository: CasualMatchRepository,
) {

    // Create a player up front (they show on the leaderboard with a 0-0-0 record
    // until they play a match).
    @Transactional
    fun createPlayer(name: String): CasualPlayerSummary {
        val p = resolvePlayer(name)
        return CasualPlayerSummary(p.id, p.name, 0, 0, 0, 0, 0.0)
    }

    @Transactional
    fun createMatch(request: CreateMatchRequest): CasualMatchView {
        val p1 = resolvePlayer(request.player1)
        val p2 = resolvePlayer(request.player2)
        if (p1.id == p2.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A player can't play themselves")
        }
        val match = matchRepository.save(
            CasualMatch(
                player1Id = p1.id,
                player2Id = p2.id,
                player1Wins = request.player1Wins,
                player2Wins = request.player2Wins,
                draws = request.draws ?: 0,
                player1Archetype = request.player1Archetype?.trim()?.takeIf { it.isNotEmpty() },
                player2Archetype = request.player2Archetype?.trim()?.takeIf { it.isNotEmpty() },
                player1DeckUrl = request.player1DeckUrl?.trim()?.takeIf { it.isNotEmpty() },
                player2DeckUrl = request.player2DeckUrl?.trim()?.takeIf { it.isNotEmpty() },
                playedOn = request.date?.trim()?.takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it) },
            ),
        )
        val names = mapOf(p1.id to p1.name, p2.id to p2.name)
        return match.toView(names)
    }

    @Transactional
    fun updateMatch(matchId: Int, request: CreateMatchRequest): CasualMatchView {
        val match = matchRepository.findById(matchId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such match")
        }
        val p1 = resolvePlayer(request.player1)
        val p2 = resolvePlayer(request.player2)
        if (p1.id == p2.id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A player can't play themselves")
        }
        match.player1Id = p1.id
        match.player2Id = p2.id
        match.player1Wins = request.player1Wins
        match.player2Wins = request.player2Wins
        match.draws = request.draws ?: 0
        match.player1Archetype = request.player1Archetype?.trim()?.takeIf { it.isNotEmpty() }
        match.player2Archetype = request.player2Archetype?.trim()?.takeIf { it.isNotEmpty() }
        match.player1DeckUrl = request.player1DeckUrl?.trim()?.takeIf { it.isNotEmpty() }
        match.player2DeckUrl = request.player2DeckUrl?.trim()?.takeIf { it.isNotEmpty() }
        match.playedOn = request.date?.trim()?.takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it) }
        matchRepository.save(match)
        return match.toView(mapOf(p1.id to p1.name, p2.id to p2.name))
    }

    @Transactional
    fun deleteMatch(matchId: Int) = matchRepository.deleteById(matchId)

    fun listMatches(): List<CasualMatchView> {
        val names = playerRepository.findAll().associate { it.id to it.name }
        return matchRepository.findAllByOrderByCreatedAtDesc().map { it.toView(names) }
    }

    fun playerNames(): List<String> = playerRepository.findAllByOrderByName().map { it.name }

    // Leaderboard: every player's overall casual record.
    fun leaderboard(): List<CasualPlayerSummary> {
        val players = playerRepository.findAllByOrderByName()
        val matches = matchRepository.findAll()
        val tallies = players.associate { it.id to Tally() }
        for (m in matches) {
            tallies[m.player1Id]?.add(outcomeFor(m, asPlayer1 = true))
            tallies[m.player2Id]?.add(outcomeFor(m, asPlayer1 = false))
        }
        return players.map { p ->
            val t = tallies.getValue(p.id)
            CasualPlayerSummary(
                id = p.id,
                name = p.name,
                matches = t.total(),
                wins = t.wins,
                losses = t.losses,
                draws = t.draws,
                matchWinPct = t.winPct(),
            )
        }.sortedWith(compareByDescending<CasualPlayerSummary> { it.matchWinPct }.thenByDescending { it.wins })
    }

    fun playerDetail(id: Int): CasualPlayerDetail {
        val player = playerRepository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such player")
        }
        val matches = matchRepository.findByPlayerId(id)
        val names = playerRepository.findAll().associate { it.id to it.name }

        val overall = Tally()
        var gamesWon = 0
        var gamesPlayed = 0
        val byMyArchetype = LinkedHashMap<String?, Tally>()
        val byOpponentArchetype = LinkedHashMap<String?, Tally>()
        val byOpponent = LinkedHashMap<Int, OpponentAgg>()

        for (m in matches) {
            val asPlayer1 = m.player1Id == id
            val outcome = outcomeFor(m, asPlayer1)
            overall.add(outcome)
            gamesWon += if (asPlayer1) m.player1Wins else m.player2Wins
            gamesPlayed += m.player1Wins + m.player2Wins + m.draws

            val myArchetype = if (asPlayer1) m.player1Archetype else m.player2Archetype
            byMyArchetype.getOrPut(myArchetype) { Tally() }.add(outcome)

            val opponentId = if (asPlayer1) m.player2Id else m.player1Id
            val opponentArchetype = if (asPlayer1) m.player2Archetype else m.player1Archetype
            byOpponentArchetype.getOrPut(opponentArchetype) { Tally() }.add(outcome)
            byOpponent.getOrPut(opponentId) { OpponentAgg(names[opponentId] ?: "?") }.tally.add(outcome)
        }

        return CasualPlayerDetail(
            id = player.id,
            name = player.name,
            matches = overall.total(),
            wins = overall.wins,
            losses = overall.losses,
            draws = overall.draws,
            matchWinPct = overall.winPct(),
            gameWinPct = if (gamesPlayed == 0) 0.0 else round3(gamesWon.toDouble() / gamesPlayed),
            archetypesPlayed = byMyArchetype.toLines(),
            vsArchetypes = byOpponentArchetype.toLines(),
            vsPlayers = byOpponent.entries
                .map { (oid, agg) -> OpponentLine(oid, agg.name, agg.tally.wins, agg.tally.losses, agg.tally.draws) }
                .sortedByDescending { it.wins + it.losses + it.draws },
            recentMatches = matches.sortedByDescending { it.createdAt }.take(20).map { it.toView(names) },
        )
    }

    // --- helpers -----------------------------------------------------------------

    private fun resolvePlayer(name: String): CasualPlayer {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Player name is required")
        return playerRepository.findFirstByNameIgnoreCase(trimmed) ?: playerRepository.save(CasualPlayer(name = trimmed))
    }

    private enum class Outcome { WIN, LOSS, DRAW }

    private fun outcomeFor(m: CasualMatch, asPlayer1: Boolean): Outcome {
        val mine = if (asPlayer1) m.player1Wins else m.player2Wins
        val theirs = if (asPlayer1) m.player2Wins else m.player1Wins
        return if (mine > theirs) Outcome.WIN else if (mine < theirs) Outcome.LOSS else Outcome.DRAW
    }

    private class Tally {
        var wins = 0
        var losses = 0
        var draws = 0
        fun add(o: Outcome) = when (o) {
            Outcome.WIN -> wins++
            Outcome.LOSS -> losses++
            Outcome.DRAW -> draws++
        }
        fun total() = wins + losses + draws
        fun winPct() = if (total() == 0) 0.0 else round3(wins.toDouble() / total())
    }

    private class OpponentAgg(val name: String) {
        val tally = Tally()
    }

    private fun LinkedHashMap<String?, Tally>.toLines(): List<RecordLine> =
        entries.map { (archetype, t) -> RecordLine(archetype, t.wins, t.losses, t.draws) }
            .sortedByDescending { it.wins + it.losses + it.draws }

    private fun CasualMatch.toView(names: Map<Int, String>) = CasualMatchView(
        id = id,
        player1Id = player1Id,
        player1Name = names[player1Id] ?: "?",
        player2Id = player2Id,
        player2Name = names[player2Id] ?: "?",
        player1Wins = player1Wins,
        player2Wins = player2Wins,
        draws = draws,
        player1Archetype = player1Archetype,
        player2Archetype = player2Archetype,
        player1DeckUrl = player1DeckUrl,
        player2DeckUrl = player2DeckUrl,
        date = playedOn?.toString(),
    )
}
