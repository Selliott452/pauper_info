package com.pauperinfo.archetype

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.google.common.util.concurrent.RateLimiter
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.URI
import java.net.http.HttpClient

// Fetches mtgdecks.net pages through the curl_cffi sidecar (which bypasses
// Cloudflare). The sidecar just returns raw HTML; all parsing happens in Kotlin.
@Component
class MtgDecksClient {

    private val objectMapper = jacksonObjectMapper()
    private val rateLimiter = RateLimiter.create(REQUESTS_PER_SECOND)

    // Pin to HTTP/1.1: the JDK HttpClient otherwise attempts an h2c upgrade against the
    // plaintext sidecar, which uvicorn rejects while silently dropping the request
    // body, causing FastAPI to return 422 ("Field required").
    private val proxyClient = RestClient.builder()
        .requestFactory(
            JdkClientHttpRequestFactory(
                HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()
            )
        )
        .build()

    fun fetch(url: String): String {
        rateLimiter.acquire()
        val body = objectMapper.writeValueAsString(mapOf("url" to url))
        repeat(3) {
            val response = proxyClient.post()
                .uri(URI.create("http://localhost:8081/fetch"))
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(ProxyResponse::class.java)!!
            if (response.status == 200) return response.body
            Thread.sleep(2000)
        }
        throw RuntimeException("Failed to fetch $url after retries")
    }

    private data class ProxyResponse(val status: Int, val body: String)

    companion object {
        const val REQUESTS_PER_SECOND = 2.0
    }
}
