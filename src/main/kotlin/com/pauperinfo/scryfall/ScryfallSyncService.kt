package com.pauperinfo.scryfall

import com.google.common.util.concurrent.RateLimiter
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import java.net.URI

@Service
class ScryfallSyncService(
    private val pageProcessor: ScryfallPageProcessor
) {

    private val log = LoggerFactory.getLogger(ScryfallSyncService::class.java)

    private val restClient = RestClient.builder()
        .defaultHeader("User-Agent", "pauper-info/1.0")
        .defaultHeader("Accept", "application/json")
        .build()

    private val rateLimiter = RateLimiter.create(2.0)

    @Async
    fun sync() {
        var url: String? = "https://api.scryfall.com/cards/search?q=f%3Apauper&unique=cards"

        while (url != null) {
            rateLimiter.acquire()

            val response = fetchWithRetry(url) ?: break

            pageProcessor.processPage(response.data)

            url = if (response.hasMore) {
                response.nextPage
            } else {
                null
            }
        }
    }

    private fun fetchWithRetry(url: String): ScryfallSearchResponse? {
        repeat(5) { attempt ->
            try {
                return restClient.get()
                    .uri(URI.create(url))
                    .retrieve()
                    .body(ScryfallSearchResponse::class.java)!!
            } catch (e: HttpClientErrorException.TooManyRequests) {
                val retryAfter = 60L
                log.warn("Rate limited by Scryfall, waiting ${retryAfter}s before retry ${attempt + 1}/5")
                Thread.sleep(retryAfter * 1000)
            }
        }
        log.error("Exhausted retries for $url")
        return null
    }
}
