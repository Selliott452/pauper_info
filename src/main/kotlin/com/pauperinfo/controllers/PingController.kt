package com.pauperinfo.controllers

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

// Cheap endpoint the frontend polls to keep the Cloud Run instance warm during
// an active session (see KeepAlive.tsx). Does no work beyond handling the request.
@RestController
class PingController {

    @GetMapping("/ping")
    fun ping(): Map<String, String> = mapOf("status" to "ok")
}
