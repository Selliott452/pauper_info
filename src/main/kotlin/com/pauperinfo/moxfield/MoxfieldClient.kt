package com.pauperinfo.moxfield

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.google.common.util.concurrent.RateLimiter
import org.slf4j.LoggerFactory
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient

@Component
class MoxfieldClient {

    private val log = LoggerFactory.getLogger(MoxfieldClient::class.java)

    private val objectMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    private val rateLimiter = RateLimiter.create(REQUESTS_PER_SECOND)

    // Pin to HTTP/1.1: the JDK HttpClient otherwise attempts an h2c upgrade against the
    // plaintext sidecar, which uvicorn rejects ("Unsupported upgrade request") while
    // silently dropping the request body, causing FastAPI to return 422.
    private val proxyClient = RestClient.builder()
        .requestFactory(
            JdkClientHttpRequestFactory(
                HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()
            )
        )
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

        val body = fetchThroughProxy(url, "cardName=$cardName page=$pageNumber")
        return objectMapper.readValue(body, MoxfieldDeckSearchResponse::class.java)
    }

    fun fetchDeckDetail(publicId: String): MoxfieldDeckDetailResponse {
        val url = "https://api2.moxfield.com/v3/decks/all/$publicId"
        val body = fetchThroughProxy(url, "deck $publicId") { throw DeckNotFoundException(publicId) }
        return objectMapper.readValue(body, MoxfieldDeckDetailResponse::class.java)
    }

    /**
     * Fetches [url] through the curl_cffi sidecar and returns the raw response body.
     *
     * Moxfield intermittently returns 403 (Cloudflare) and 429 (rate limit), so we
     * retry with short backoffs. [label] is only for log/error context. [onNotFound]
     * lets a caller translate a 404 into a domain exception (a missing deck); when
     * unset, a 404 is treated like any other unexpected status.
     */
    private fun fetchThroughProxy(
        url: String,
        label: String,
        onNotFound: (() -> Nothing)? = null,
    ): String {
        rateLimiter.acquire()
        repeat(MAX_ATTEMPTS) { attempt ->
            val response = proxyClient.post()
                .uri(URI.create("http://localhost:8081/fetch"))
                .header("Content-Type", "application/json")
                .body("""{"url":"$url"}""")
                .retrieve()
                .body(ProxyResponse::class.java)!!

            when (response.status) {
                200 -> return response.body
                403 -> {
                    log.warn("Got 403 for $label (attempt ${attempt + 1}/$MAX_ATTEMPTS), retrying")
                    Thread.sleep(2000)
                }
                429 -> {
                    log.warn("Rate limited for $label (attempt ${attempt + 1}/$MAX_ATTEMPTS), backing off 10s")
                    Thread.sleep(10000)
                }
                404 -> onNotFound?.invoke() ?: throw RuntimeException("Moxfield returned 404 for $label")
                else -> throw RuntimeException("Moxfield returned ${response.status} for $label")
            }
        }
        throw RuntimeException("Exhausted retries for $label")
    }

    companion object {
        const val POOL_SIZE = 50
        const val REQUESTS_PER_SECOND = 15.0
        private const val MAX_ATTEMPTS = 3
    }

    private data class ProxyResponse(val status: Int, val body: String)
}
