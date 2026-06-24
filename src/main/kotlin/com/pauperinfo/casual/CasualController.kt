package com.pauperinfo.casual

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/casual")
class CasualController(private val casualService: CasualService) {

    @GetMapping("/players")
    fun leaderboard(): List<CasualPlayerSummary> = casualService.leaderboard()

    @PostMapping("/players")
    fun createPlayer(@RequestBody request: CreateCasualPlayerRequest): CasualPlayerSummary =
        casualService.createPlayer(request.name)

    // Plain player names, for the match-entry picker's suggestions.
    @GetMapping("/players/names")
    fun playerNames(): List<String> = casualService.playerNames()

    @GetMapping("/players/{id}")
    fun playerDetail(@PathVariable id: Int): CasualPlayerDetail = casualService.playerDetail(id)

    @GetMapping("/matches")
    fun matches(): List<CasualMatchView> = casualService.listMatches()

    @PostMapping("/matches")
    fun createMatch(@RequestBody request: CreateMatchRequest): CasualMatchView = casualService.createMatch(request)

    @PutMapping("/matches/{id}")
    fun updateMatch(@PathVariable id: Int, @RequestBody request: CreateMatchRequest): CasualMatchView =
        casualService.updateMatch(id, request)

    @DeleteMapping("/matches/{id}")
    fun deleteMatch(@PathVariable id: Int): ResponseEntity<Void> {
        casualService.deleteMatch(id)
        return ResponseEntity.noContent().build()
    }
}
