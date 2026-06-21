package com.pauperinfo.moxfield

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.microsoft.playwright.Browser
import com.microsoft.playwright.BrowserContext
import com.microsoft.playwright.BrowserType
import com.microsoft.playwright.Page
import com.microsoft.playwright.Playwright
import com.microsoft.playwright.options.WaitUntilState
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Callable
import java.util.concurrent.Executors

@Component
class MoxfieldClient {

    private val log = LoggerFactory.getLogger(MoxfieldClient::class.java)

    private val objectMapper = jacksonObjectMapper()
        .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)

    private val workerPool = ArrayBlockingQueue<PlaywrightWorker>(POOL_SIZE)

    init {
        repeat(POOL_SIZE) { i ->
            log.info("Initializing browser context ${i + 1}/$POOL_SIZE")
            val worker = PlaywrightWorker()
            worker.init()
            workerPool.put(worker)
        }
        log.info("All $POOL_SIZE browser contexts ready")
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

        val worker = workerPool.take()
        try {
            return worker.fetch(url, cardName, pageNumber, objectMapper, log)
        } finally {
            workerPool.put(worker)
        }
    }

    @PreDestroy
    fun close() {
        workerPool.forEach { it.close() }
    }

    companion object {
        const val POOL_SIZE = 10
    }
}

class PlaywrightWorker {

    private val executor = Executors.newSingleThreadExecutor()

    private lateinit var playwright: Playwright
    private lateinit var browser: Browser
    private lateinit var context: BrowserContext

    fun init() {
        executor.submit(Callable {
            playwright = Playwright.create()
            browser = playwright.chromium().launch(BrowserType.LaunchOptions().setHeadless(true))
            context = browser.newContext(
                Browser.NewContextOptions()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
                    .setExtraHTTPHeaders(mapOf(
                        "accept-language" to "en-US,en;q=0.9",
                        "origin" to "https://moxfield.com",
                        "referer" to "https://moxfield.com/",
                        "x-moxfield-version" to "2026.06.19.1"
                    ))
            )
            val page = context.newPage()
            page.navigate("https://moxfield.com")
            page.waitForLoadState()
            Thread.sleep(3000)
            page.close()
        }).get()
    }

    fun fetch(
        url: String,
        cardName: String,
        pageNumber: Int,
        objectMapper: com.fasterxml.jackson.databind.ObjectMapper,
        log: org.slf4j.Logger
    ): MoxfieldDeckSearchResponse {
        return executor.submit(Callable {
            repeat(3) { attempt ->
                val page = context.newPage()
                try {
                    val response = page.navigate(
                        url,
                        Page.NavigateOptions()
                            .setWaitUntil(WaitUntilState.DOMCONTENTLOADED)
                            .setTimeout(60000.0)
                    ) ?: throw RuntimeException("No response for cardName=$cardName page=$pageNumber")

                    if (!response.ok()) {
                        throw RuntimeException("Moxfield API returned ${response.status()} for cardName=$cardName page=$pageNumber")
                    }

                    val body = page.locator("body").innerText()
                    return@Callable objectMapper.readValue(body, MoxfieldDeckSearchResponse::class.java)
                } catch (e: com.microsoft.playwright.TimeoutError) {
                    log.warn("Timeout on cardName=$cardName page=$pageNumber, retry ${attempt + 1}/3")
                    if (attempt == 2) throw e
                } finally {
                    page.close()
                }
            }
            throw RuntimeException("Exhausted retries for cardName=$cardName page=$pageNumber")
        }).get()
    }

    fun close() {
        executor.submit {
            context.close()
            browser.close()
            playwright.close()
        }.get()
        executor.shutdown()
    }
}
