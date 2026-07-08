plugins {
	kotlin("jvm") version "2.3.21"
	kotlin("plugin.spring") version "2.3.21"
	kotlin("plugin.jpa") version "2.3.21"
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.google.cloud.tools.jib") version "3.4.4"
}

group = "com.pauperinfo"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(17)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	runtimeOnly("org.postgresql:postgresql")
	implementation("com.google.guava:guava:33.4.8-jre")
	implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
	implementation("org.jsoup:jsoup:1.18.3")
	implementation("org.flywaydb:flyway-core")
	implementation("org.flywaydb:flyway-database-postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}

jib {
	from {
		// Eclipse Temurin JRE 17 on Ubuntu (full distro, not distroless) so the app
		// has the shared libraries Playwright's bundled browsers need at runtime.
		image = "eclipse-temurin:17-jre"
	}
	to {
		// Overridden on the CLI in CI: -Djib.to.image=REGION-docker.pkg.dev/PROJECT/REPO/pauper-info:TAG
		image = "pauper-info"
	}
	container {
		ports = listOf("8080")
		// Cloud Run sets $PORT; Spring honours SERVER_PORT.
		environment = mapOf("SERVER_PORT" to "8080")
		jvmFlags = listOf(
			"-XX:MaxRAMPercentage=75",
			// Avoid SecureRandom blocking on /dev/random for entropy during startup.
			"-Djava.security.egd=file:/dev/./urandom",
			// Skip the C2 JIT tier: faster class warmup at the cost of peak
			// throughput, a good trade for short-lived Cloud Run instances.
			"-XX:TieredStopAtLevel=1",
		)
	}
}
