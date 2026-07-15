package com.pauperinfo.tournament

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/tournaments")
class TournamentController(private val swissService: SwissService) {

    @GetMapping
    fun list(): List<TournamentSummary> = swissService.list()

    @PostMapping
    fun create(@RequestBody request: CreateTournamentRequest): TournamentDetail = swissService.create(request)

    @PatchMapping("/{id}")
    fun update(@PathVariable id: Int, @RequestBody request: UpdateTournamentRequest): TournamentDetail =
        swissService.update(id, request)

    @GetMapping("/{id}")
    fun detail(@PathVariable id: Int): TournamentDetail = swissService.detail(id)

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Int): ResponseEntity<Void> {
        swissService.delete(id)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{id}/complete")
    fun complete(@PathVariable id: Int): TournamentDetail = swissService.setStatus(id, "COMPLETE")

    @PostMapping("/{id}/reopen")
    fun reopen(@PathVariable id: Int): TournamentDetail = swissService.setStatus(id, "ACTIVE")

    @PostMapping("/{id}/pair")
    fun pair(@PathVariable id: Int): TournamentDetail = swissService.pairNextRound(id)

    // Manual pairing: add a round you pair yourself, add/remove pairings within it.
    @PostMapping("/{id}/rounds")
    fun addRound(@PathVariable id: Int): TournamentDetail = swissService.addRound(id)

    @PostMapping("/{id}/rounds/{roundId}/matches")
    fun addMatch(
        @PathVariable id: Int,
        @PathVariable roundId: Int,
        @RequestBody request: AddMatchRequest,
    ): TournamentDetail = swissService.addMatch(id, roundId, request)

    @DeleteMapping("/{id}/rounds/{roundId}")
    fun deleteRound(@PathVariable id: Int, @PathVariable roundId: Int): TournamentDetail =
        swissService.deleteRound(id, roundId)

    // Start/pause/resume/reset a round's timer.
    @PostMapping("/{id}/rounds/{roundId}/timer/{action}")
    fun roundTimer(
        @PathVariable id: Int,
        @PathVariable roundId: Int,
        @PathVariable action: String,
    ): TournamentDetail = swissService.roundTimer(id, roundId, action)

    @DeleteMapping("/{id}/matches/{matchId}")
    fun deleteMatch(@PathVariable id: Int, @PathVariable matchId: Int): TournamentDetail =
        swissService.deleteMatch(id, matchId)

    @PostMapping("/{id}/matches/{matchId}")
    fun report(
        @PathVariable id: Int,
        @PathVariable matchId: Int,
        @RequestBody request: ReportResultRequest,
    ): TournamentDetail = swissService.reportResult(id, matchId, request)

    @PostMapping("/{id}/players")
    fun addPlayer(@PathVariable id: Int, @RequestBody request: AddPlayerRequest): TournamentDetail =
        swissService.addPlayer(id, request.name)

    @DeleteMapping("/{id}/players/{playerId}")
    fun removePlayer(@PathVariable id: Int, @PathVariable playerId: Int): TournamentDetail =
        swissService.removePlayer(id, playerId)

    @PostMapping("/{id}/players/{playerId}/drop")
    fun drop(@PathVariable id: Int, @PathVariable playerId: Int): TournamentDetail =
        swissService.dropPlayer(id, playerId)

    @PostMapping("/{id}/players/{playerId}/rejoin")
    fun rejoin(@PathVariable id: Int, @PathVariable playerId: Int): TournamentDetail =
        swissService.rejoinPlayer(id, playerId)

    @PatchMapping("/{id}/players/{playerId}")
    fun updatePlayer(
        @PathVariable id: Int,
        @PathVariable playerId: Int,
        @RequestBody request: UpdatePlayerRequest,
    ): TournamentDetail = swissService.updatePlayer(id, playerId, request)
}
