package com.pauperinfo.moxfield

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.microsoft.playwright.Browser
import com.microsoft.playwright.BrowserType
import com.microsoft.playwright.Playwright
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class MoxfieldClient {

    private val objectMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    private val log = LoggerFactory.getLogger(MoxfieldClient::class.java)

    private val playwright: Playwright = Playwright.create()

    private val browser: Browser = playwright.chromium().launch(
        BrowserType.LaunchOptions().setHeadless(true)
    )

    private val context = browser.newContext(
        Browser.NewContextOptions()
            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
            .setExtraHTTPHeaders(mapOf(
                "accept-language" to "en-US,en;q=0.9",
                "origin" to "https://moxfield.com",
                "referer" to "https://moxfield.com/",
                "x-moxfield-version" to "2026.06.19.1"
            ))
    )

    init {
        solveCloudflare()
    }

    private fun solveCloudflare() {
        log.info("Solving Cloudflare challenge...")
        val page = context.newPage()
        page.navigate("https://moxfield.com")
        page.waitForLoadState()
        Thread.sleep(3000)
        page.close()
        log.info("Cloudflare challenge complete")
    }

    fun searchDecks(cardName: String, pageNumber: Int): MoxfieldDeckSearchResponse {
        val encodedName = java.net.URLEncoder.encode(cardName, "UTF-8")
        val url = "https://api2.moxfield.com/v2/decks/search-sfw" +
            "?pageNumber=$pageNumber" +
            "&pageSize=100" +
            "&sortType=updated" +
            "&sortDirection=descending" +
            "&fmt=pauper" +
            "&cardName=$encodedName"

        val page = context.newPage()
        try {
            val response = page.navigate(url)
                ?: throw RuntimeException("No response for cardName=$cardName page=$pageNumber")

            if (!response.ok()) {
                throw RuntimeException("Moxfield API returned ${response.status()} for cardName=$cardName page=$pageNumber")
            }

            val body = page.locator("body").innerText()
            return objectMapper.readValue(body, MoxfieldDeckSearchResponse::class.java)
        } finally {
            page.close()
        }
    }

    @PreDestroy
    fun close() {
        context.close()
        browser.close()
        playwright.close()
    }
}
