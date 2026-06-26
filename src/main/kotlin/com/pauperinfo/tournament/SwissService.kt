package com.pauperinfo.tournament

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Duration
import java.time.LocalDate
import java.time.OffsetDateTime

@Service
class SwissService(
    private val competitorRepository: CompetitorRepository,
    private val eventRepository: EventRepository,
    private val playerRepository: PlayerRepository,
    private val roundRepository: RoundRepository,
    private val matchRepository: MatchRepository,
) {

    @Transactional
    fun create(request: CreateTournamentRequest): TournamentDetail {
        val names = request.players.map { it.trim() }.filter { it.isNotEmpty() }
        if (names.size < 2) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A tournament needs at least 2 players")
        }
        val event = eventRepository.save(
            Event(
                name = request.name.trim().ifEmpty { "Untitled" },
                status = "ACTIVE",
                eventDate = parseDate(request.date),
                roundMinutes = normalizeMinutes(request.roundMinutes),
            ),
        )
        // Resolve each name to an existing competitor (case-insensitive) or create one,
        // then add them to this event. This is what links results to a career record.
        names.forEach { name ->
            val competitor = competitorRepository.findFirstByNameIgnoreCase(name)
                ?: competitorRepository.save(Competitor(name = name))
            playerRepository.save(Player(eventId = event.id, competitorId = competitor.id, name = competitor.name))
        }
        return detail(event.id)
    }

    fun list(): List<TournamentSummary> = eventRepository.findAllByOrderByCreatedAtDesc()
        // Most recent event date first; undated events fall to the bottom.
        .sortedByDescending { it.eventDate ?: LocalDate.MIN }
        .map { event ->
            TournamentSummary(
                id = event.id,
                name = event.name,
                date = event.eventDate?.toString(),
                status = event.status,
                playerCount = playerRepository.findByEventId(event.id).size,
                currentRound = roundRepository.findByEventIdOrderByNumber(event.id).size,
            )
        }

    @Transactional
    fun update(eventId: Int, request: UpdateTournamentRequest): TournamentDetail {
        val event = event(eventId)
        if (request.name.isNotBlank()) event.name = request.name.trim()
        event.eventDate = parseDate(request.date)
        event.roundMinutes = normalizeMinutes(request.roundMinutes)
        eventRepository.save(event)
        return detail(eventId)
    }

    private fun parseDate(value: String?): LocalDate? =
        value?.trim()?.takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it) }

    // A non-positive or null round length means "no timer".
    private fun normalizeMinutes(value: Int?): Int? = value?.takeIf { it > 0 }

    // Mark finished (locks pairing/drops) or reopen for more rounds.
    @Transactional
    fun setStatus(eventId: Int, status: String): TournamentDetail {
        if (status != "ACTIVE" && status != "COMPLETE") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be ACTIVE or COMPLETE")
        }
        val event = event(eventId)
        event.status = status
        eventRepository.save(event)
        return detail(eventId)
    }

    @Transactional
    fun delete(eventId: Int) {
        // Delete children before the event so match→player references never dangle,
        // regardless of FK cascade ordering.
        val rounds = roundRepository.findByEventIdOrderByNumber(eventId)
        matchRepository.deleteAll(matchRepository.findByRoundIdIn(rounds.map { it.id }))
        roundRepository.deleteAll(rounds)
        playerRepository.deleteAll(playerRepository.findByEventId(eventId))
        eventRepository.deleteById(eventId)
    }

    @Transactional
    fun dropPlayer(eventId: Int, playerId: Int): TournamentDetail {
        requireActive(eventId)
        val player = playerRepository.findById(playerId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such player")
        }
        player.dropped = true
        playerRepository.save(player)
        return detail(eventId)
    }

    // Reinstate a dropped player so they're paired again.
    @Transactional
    fun rejoinPlayer(eventId: Int, playerId: Int): TournamentDetail {
        requireActive(eventId)
        val player = playerRepository.findById(playerId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such player")
        }
        player.dropped = false
        playerRepository.save(player)
        return detail(eventId)
    }

    // Record (or clear) the archetype/deck a player ran. Allowed even when complete.
    @Transactional
    fun updatePlayer(eventId: Int, playerId: Int, request: UpdatePlayerRequest): TournamentDetail {
        val player = playerRepository.findById(playerId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such player")
        }
        player.archetype = request.archetype?.trim()?.takeIf { it.isNotEmpty() }
        player.deckUrl = request.deckUrl?.trim()?.takeIf { it.isNotEmpty() }
        playerRepository.save(player)
        return detail(eventId)
    }

    @Transactional
    fun reportResult(eventId: Int, matchId: Int, request: ReportResultRequest): TournamentDetail {
        requireActive(eventId)
        val match = matchRepository.findById(matchId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such match")
        }
        if (match.player2Id == null) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Bye results can't be edited")
        }
        match.player1Wins = request.player1Wins
        match.player2Wins = request.player2Wins
        match.draws = request.draws
        match.reported = true
        matchRepository.save(match)
        return detail(eventId)
    }

    // --- manual pairing -----------------------------------------------------------

    /** Adds an empty round you pair yourself (for retroactive entry or live fixes). */
    @Transactional
    fun addRound(eventId: Int): TournamentDetail {
        requireActive(eventId)
        val number = roundRepository.findByEventIdOrderByNumber(eventId).size + 1
        roundRepository.save(Round(eventId = eventId, number = number))
        return detail(eventId)
    }

    /** Manually adds a pairing to a round. A null player2 records a bye (2-0). */
    @Transactional
    fun addMatch(eventId: Int, roundId: Int, request: AddMatchRequest): TournamentDetail {
        requireActive(eventId)
        val round = roundRepository.findById(roundId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such round")
        }
        if (round.eventId != eventId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Round is not in this tournament")
        }
        if (request.player2Id != null && request.player2Id == request.player1Id) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "A player can't be paired against themselves")
        }
        // A player may only appear once per round.
        val alreadyPaired = HashSet<Int>()
        for (m in matchRepository.findByRoundIdIn(listOf(roundId))) {
            alreadyPaired.add(m.player1Id)
            m.player2Id?.let { alreadyPaired.add(it) }
        }
        if (request.player1Id in alreadyPaired || (request.player2Id != null && request.player2Id in alreadyPaired)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "That player is already paired this round")
        }
        val match = if (request.player2Id == null) {
            Match(roundId = roundId, player1Id = request.player1Id, player2Id = null, player1Wins = 2, reported = true)
        } else {
            Match(roundId = roundId, player1Id = request.player1Id, player2Id = request.player2Id)
        }
        matchRepository.save(match)
        return detail(eventId)
    }

    /** Deletes a round and its matches, then re-sequences the remaining round numbers. */
    @Transactional
    fun deleteRound(eventId: Int, roundId: Int): TournamentDetail {
        requireActive(eventId)
        val round = roundRepository.findById(roundId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such round")
        }
        if (round.eventId != eventId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Round is not in this tournament")
        }
        matchRepository.deleteAll(matchRepository.findByRoundIdIn(listOf(roundId)))
        roundRepository.delete(round)

        roundRepository.findByEventIdOrderByNumber(eventId).forEachIndexed { i, r ->
            if (r.number != i + 1) {
                r.number = i + 1
                roundRepository.save(r)
            }
        }
        return detail(eventId)
    }

    /** Removes a pairing (e.g. to re-pair it manually). */
    @Transactional
    fun deleteMatch(eventId: Int, matchId: Int): TournamentDetail {
        requireActive(eventId)
        matchRepository.deleteById(matchId)
        return detail(eventId)
    }

    // --- round timer --------------------------------------------------------------

    /**
     * Drives a round's timer. Actions:
     *  - start:  begin a fresh countdown of the tournament's round length.
     *  - pause:  freeze the remaining time.
     *  - resume: resume a paused countdown.
     *  - reset:  clear the timer back to not-started.
     */
    @Transactional
    fun roundTimer(eventId: Int, roundId: Int, action: String): TournamentDetail {
        requireActive(eventId)
        val round = roundRepository.findById(roundId).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "No such round")
        }
        if (round.eventId != eventId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Round is not in this tournament")
        }
        val now = OffsetDateTime.now()
        when (action) {
            "start" -> {
                val minutes = event(eventId).roundMinutes
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Set a round length first")
                round.timerEndsAt = now.plusMinutes(minutes.toLong())
                round.timerRemainingSeconds = null
            }
            "pause" -> {
                val endsAt = round.timerEndsAt ?: return detail(eventId)
                round.timerRemainingSeconds = maxOf(0, Duration.between(now, endsAt).seconds.toInt())
                round.timerEndsAt = null
            }
            "resume" -> {
                val remaining = round.timerRemainingSeconds ?: return detail(eventId)
                round.timerEndsAt = now.plusSeconds(remaining.toLong())
                round.timerRemainingSeconds = null
            }
            "reset" -> {
                round.timerEndsAt = null
                round.timerRemainingSeconds = null
            }
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown timer action")
        }
        roundRepository.save(round)
        return detail(eventId)
    }

    /** Pairs the next Swiss round and returns the updated tournament. */
    @Transactional
    fun pairNextRound(eventId: Int): TournamentDetail {
        requireActive(eventId)
        val rounds = roundRepository.findByEventIdOrderByNumber(eventId)
        val existingMatches = matchRepository.findByRoundIdIn(rounds.map { it.id })
        if (existingMatches.any { !it.reported }) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Report all results before pairing the next round")
        }

        val players = playerRepository.findByEventId(eventId)
        val active = players.filter { !it.dropped }
        if (active.size < 2) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Need at least 2 active players to pair")
        }

        // Who has played whom, and who has already had a bye.
        val playedAgainst = HashMap<Int, MutableSet<Int>>()
        val hadBye = HashSet<Int>()
        for (m in existingMatches) {
            if (m.player2Id == null) {
                hadBye.add(m.player1Id)
            } else {
                playedAgainst.getOrPut(m.player1Id) { mutableSetOf() }.add(m.player2Id!!)
                playedAgainst.getOrPut(m.player2Id!!) { mutableSetOf() }.add(m.player1Id)
            }
        }

        // Order by match points (desc); shuffle first so equal-points players pair in
        // a varied order (and round 1, where everyone is 0, is fully random).
        val points = matchPointsByPlayer(players, existingMatches)
        val ordered = active.shuffled().sortedByDescending { points[it.id] ?: 0 }.toMutableList()

        // Odd field: the lowest-standing player without a bye yet gets this round's bye.
        var byePlayer: Player? = null
        if (ordered.size % 2 == 1) {
            byePlayer = ordered.lastOrNull { it.id !in hadBye } ?: ordered.last()
            ordered.remove(byePlayer)
        }

        // Greedy pairing down the standings, preferring opponents not yet played.
        val unpaired = ordered.toMutableList()
        val pairings = mutableListOf<Pair<Int, Int>>()
        while (unpaired.isNotEmpty()) {
            val a = unpaired.removeAt(0)
            val played = playedAgainst[a.id] ?: emptySet()
            val opponentIdx = unpaired.indexOfFirst { it.id !in played }
            val b = unpaired.removeAt(if (opponentIdx >= 0) opponentIdx else 0)
            pairings.add(a.id to b.id)
        }

        val round = roundRepository.save(Round(eventId = eventId, number = rounds.size + 1))
        pairings.forEach { (p1, p2) -> matchRepository.save(Match(roundId = round.id, player1Id = p1, player2Id = p2)) }
        // A bye is a recorded 2-0 win, no opponent.
        byePlayer?.let {
            matchRepository.save(Match(roundId = round.id, player1Id = it.id, player2Id = null, player1Wins = 2, reported = true))
        }
        return detail(eventId)
    }

    fun detail(eventId: Int): TournamentDetail {
        val event = event(eventId)
        val players = playerRepository.findByEventId(eventId)
        val playerById = players.associateBy { it.id }
        val rounds = roundRepository.findByEventIdOrderByNumber(eventId)
        val matches = matchRepository.findByRoundIdIn(rounds.map { it.id })
        val matchesByRound = matches.groupBy { it.roundId }

        val roundViews = rounds.map { round ->
            RoundView(
                id = round.id,
                number = round.number,
                timerEndsAt = round.timerEndsAt?.toString(),
                timerRemainingSeconds = round.timerRemainingSeconds,
                matches = (matchesByRound[round.id] ?: emptyList()).map { m ->
                    MatchView(
                        matchId = m.id,
                        player1Id = m.player1Id,
                        player1Name = playerById[m.player1Id]?.name ?: "?",
                        player2Id = m.player2Id,
                        player2Name = m.player2Id?.let { playerById[it]?.name },
                        player1Wins = m.player1Wins,
                        player2Wins = m.player2Wins,
                        draws = m.draws,
                        reported = m.reported,
                        bye = m.player2Id == null,
                    )
                },
            )
        }

        val allReported = matches.all { it.reported }
        val canPair = event.status == "ACTIVE" && allReported
        return TournamentDetail(
            id = event.id,
            name = event.name,
            date = event.eventDate?.toString(),
            status = event.status,
            currentRound = rounds.size,
            roundMinutes = event.roundMinutes,
            canPair = canPair,
            standings = computeStandings(players, matches),
            roundViews = roundViews,
        )
    }

    // --- standings & tiebreakers -------------------------------------------------

    private class Stats {
        var matchPoints = 0
        var matchesPlayed = 0
        var wins = 0
        var losses = 0
        var draws = 0
        var gamePoints = 0
        var gamesPlayed = 0
        val opponents = mutableListOf<Int>()
    }

    private fun matchPointsByPlayer(players: List<Player>, matches: List<Match>): Map<Int, Int> =
        accumulate(players, matches).mapValues { it.value.matchPoints }

    private fun accumulate(players: List<Player>, matches: List<Match>): Map<Int, Stats> {
        val stats = players.associate { it.id to Stats() }
        for (m in matches) {
            if (!m.reported) continue
            val p1 = stats[m.player1Id] ?: continue
            if (m.player2Id == null) {
                // Bye: counts as a match win and a 2-0 game record; no opponent.
                p1.matchPoints += 3; p1.matchesPlayed += 1; p1.wins += 1
                p1.gamePoints += 6; p1.gamesPlayed += 2
                continue
            }
            val p2 = stats[m.player2Id] ?: continue
            p1.matchesPlayed += 1; p2.matchesPlayed += 1
            p1.opponents.add(m.player2Id!!); p2.opponents.add(m.player1Id)
            when {
                m.player1Wins > m.player2Wins -> { p1.matchPoints += 3; p1.wins++; p2.losses++ }
                m.player1Wins < m.player2Wins -> { p2.matchPoints += 3; p2.wins++; p1.losses++ }
                else -> { p1.matchPoints += 1; p2.matchPoints += 1; p1.draws++; p2.draws++ }
            }
            p1.gamePoints += m.player1Wins * 3 + m.draws
            p2.gamePoints += m.player2Wins * 3 + m.draws
            val games = m.player1Wins + m.player2Wins + m.draws
            p1.gamesPlayed += games; p2.gamesPlayed += games
        }
        return stats
    }

    private fun computeStandings(players: List<Player>, matches: List<Match>): List<PlayerStanding> {
        val stats = accumulate(players, matches)
        // Match-win % and game-win %, each floored at 1/3 per MTG rules.
        val mwp = stats.mapValues { (_, s) -> if (s.matchesPlayed == 0) 0.0 else floor33(s.matchPoints.toDouble() / (3 * s.matchesPlayed)) }
        val gwp = stats.mapValues { (_, s) -> if (s.gamesPlayed == 0) 0.0 else floor33(s.gamePoints.toDouble() / (3 * s.gamesPlayed)) }

        fun avg(ids: List<Int>, table: Map<Int, Double>) = if (ids.isEmpty()) 0.0 else ids.map { table[it] ?: 0.0 }.average()

        val standings = players.map { p ->
            val s = stats.getValue(p.id)
            PlayerStanding(
                rank = 0,
                playerId = p.id,
                competitorId = p.competitorId,
                name = p.name,
                archetype = p.archetype,
                deckUrl = p.deckUrl,
                dropped = p.dropped,
                matchPoints = s.matchPoints,
                wins = s.wins,
                losses = s.losses,
                draws = s.draws,
                omwp = round3(avg(s.opponents, mwp)),
                gwp = round3(gwp.getValue(p.id)),
                ogwp = round3(avg(s.opponents, gwp)),
            )
        }.sortedWith(
            compareByDescending<PlayerStanding> { it.matchPoints }
                .thenByDescending { it.omwp }
                .thenByDescending { it.gwp }
                .thenByDescending { it.ogwp },
        )
        return standings.mapIndexed { i, st -> st.copy(rank = i + 1) }
    }

    private fun floor33(value: Double) = maxOf(value, 1.0 / 3.0)
    private fun round3(value: Double) = Math.round(value * 1000) / 1000.0

    private fun event(eventId: Int): Event = eventRepository.findById(eventId).orElseThrow {
        ResponseStatusException(HttpStatus.NOT_FOUND, "No such tournament")
    }

    // Editing (pairing, results, drops) is locked once a tournament is complete.
    private fun requireActive(eventId: Int) {
        if (event(eventId).status == "COMPLETE") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Tournament is complete - reopen it to make changes")
        }
    }
}
