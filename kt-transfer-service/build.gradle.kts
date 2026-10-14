// Подключение плагинов, расширяющих возможности Gradle
plugins {
    // alias берёт TOML-плагин kotlin-jvm и применяет его к проекту
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    application // стандартный плагин Gradle, добавляет кучу полезных команд
}

/**
 * Идентификаторы проекта
 * */
group = "dev.simbirsoft.minibank"
version = "0.1.0"

repositories {
    mavenCentral() // зависимости ищем в Maven Central Repository
}

dependencies {
    // Ktor-зависимости из bundle в основной набор
    implementation(libs.bundles.ktor.server)
    // Подключает Logback для логирования
    implementation(libs.logback.classic)

    // Удобные API для тестирования
    testImplementation(kotlin("test"))
    // Тестовый движок Ktor
    testImplementation(libs.ktor.server.test.host)
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass.set("dev.simbirsoft.minibank.ApplicationKt")
}

tasks.test {
    useJUnitPlatform()
}
