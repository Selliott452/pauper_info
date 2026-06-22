package com.pauperinfo.moxfield

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.google.common.util.concurrent.RateLimiter
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.URI
import java.net.URLEncoder

@Component
class MoxfieldClient {

    private val log = LoggerFactory.getLogger(MoxfieldClient::class.java)

    private val objectMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    private val rateLimiter = RateLimiter.create(REQUESTS_PER_SECOND)

    private val proxyClient = RestClient.builder()
        .baseUrl("http://localhost:8081")
        .build()

    fun searchDecks(cardName: String, pageNumber: Int): MoxfieldDeckSearchResponse {
        val encodedName = URLEncoder.encode(cardName, "UTF-8")
        val url = "https://api2.moxfield.com/v2/decks/search-sfw" +
            "?pageNumber=$pageNumber" +
            "&pageSize=100" +
            "&sortType=updated" +
            "&sortDirection=descending" +
            "&fmt=pauper" +
            "&cardName=$encodedName"

        rateLimiter.acquire()
        repeat(3) { attempt ->
            val proxyResponse = proxyClient.post()
                .uri(URI.create("http://localhost:8081/fetch"))
                .header("Content-Type", "application/json")
                .body("""{"url":"$url"}""")
                .retrieve()
                .body(ProxyResponse::class.java)!!

            when (proxyResponse.status) {
                200 -> return objectMapper.readValue(proxyResponse.body, MoxfieldDeckSearchResponse::class.java)
                403 -> {
                    log.warn("Got 403 for cardName=$cardName page=$pageNumber (attempt ${attempt + 1}/3), retrying")
                    Thread.sleep(2000)
                }
                429 -> {
                    log.warn("Rate limited for cardName=$cardName page=$pageNumber (attempt ${attempt + 1}/3), backing off 10s")
                    Thread.sleep(10000)
                }
                else -> throw RuntimeException("Moxfield returned ${proxyResponse.status} for cardName=$cardName page=$pageNumber")
            }
        }

        throw RuntimeException("Exhausted retries for cardName=$cardName page=$pageNumber")
    }

    fun fetchDeckDetail(publicId: String): MoxfieldDeckDetailResponse {
        val url = "https://api2.moxfield.com/v3/decks/all/$publicId"

        rateLimiter.acquire()
        repeat(3) { attempt ->
            val proxyResponse = proxyClient.post()
                .uri(URI.create("http://localhost:8081/fetch"))
                .header("Content-Type", "application/json")
                .body("""{"url":"$url"}""")
                .retrieve()
                .body(ProxyResponse::class.java)!!

            when (proxyResponse.status) {
                200 -> return objectMapper.readValue(proxyResponse.body, MoxfieldDeckDetailResponse::class.java)
                403 -> {
                    log.warn("Got 403 for deck $publicId (attempt ${attempt + 1}/3), retrying")
                    Thread.sleep(2000)
                }
                429 -> {
                    log.warn("Rate limited for deck $publicId (attempt ${attempt + 1}/3), backing off 10s")
                    Thread.sleep(10000)
                }
                404 -> throw DeckNotFoundException(publicId)
                else -> throw RuntimeException("Moxfield returned ${proxyResponse.status} for deck $publicId")
            }
        }

        throw RuntimeException("Exhausted retries for deck $publicId")
    }

    companion object {
        const val POOL_SIZE = 50
        const val REQUESTS_PER_SECOND = 20.0
    }

    private data class ProxyResponse(val status: Int, val body: String)
}
