# Мини-банк — фронтенд

Одна страница на React, TypeScript и Bootstrap: создание счёта, баланс, поиск получателя, перевод и история операций. Сборка — Vite. Состояние хранится в React; отдельного роутера и библиотеки управления состоянием нет.

## Быстро посмотреть интерфейс

Нужен Node.js 22.13+ из ветки 22 LTS либо Node.js 24+.

```bash
cd /home/shaman_stepan/mini_bank/front
npm install
npm run demo
```

Откройте http://localhost:5173. Создайте счёт с псевдонимом `alice_01`, найдите `bob_02` или `charlie_03` и отправьте перевод. Начальный баланс — 1 000 виртуальных рублей. Перевод больше остатка завершится отказом.

Демо явно помечено в интерфейсе, не отправляет запросы к API и сбрасывает данные при обновлении страницы. Это способ посмотреть фронт до запуска сервисов, а не проверка бэкенда.

## Подключить настоящие сервисы

```bash
cp .env.example .env
npm run dev
```

Отредактируйте `.env` под свои адреса:

| Переменная                | Назначение                                                                     |
| ------------------------- | ------------------------------------------------------------------------------ |
| `VITE_KEYCLOAK_URL`       | URL Keycloak, доступный браузеру; пример `http://localhost:8081`               |
| `VITE_KEYCLOAK_REALM`     | Realm; пример `mini-bank`                                                      |
| `VITE_KEYCLOAK_CLIENT_ID` | Публичный клиент SPA; пример `mini-bank-front`                                 |
| `VITE_API_BASE_URL`       | Пусто для одного origin. При отдельном gateway — его origin без `/api`         |
| `DEV_API_TARGET`          | Адрес gateway для локального прокси Vite; по умолчанию `http://localhost:8080` |

После изменения `.env` перезапустите Vite. Порт `8081` и имена realm/client — примеры, их нужно согласовать с вашей конфигурацией. Все `VITE_*` попадают в браузерную сборку: секреты и пароли в них не размещаются.

Для клиента Keycloak включите Standard flow и PKCE S256, отключите Client authentication. Для локальной разработки задайте Valid redirect URIs `http://localhost:5173/*`, Valid post logout redirect URIs `http://localhost:5173/` и Web origins `http://localhost:5173`. Для VPS добавьте адрес HTTPS вашего фронта. Регистрация появится на странице входа, если включить её в realm. Пользователям нужна роль `mini-bank-user`; audience access token должен соответствовать настройкам gateway и обоих сервисов.

Фронт использует официальный `keycloak-js`: Authorization Code + PKCE, обновление токена перед запросами. Токены остаются в памяти. При истечении сессии приложение предлагает войти снова.

## API

Все запросы идут через gateway с `Authorization: Bearer ...`.

| Метод и путь                                       | Использование                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/accounts`                               | `{ "recipientHandle": "alice_01" }`                                                   |
| `GET /api/accounts/me`                             | Свой счёт и баланс; `404` открывает форму создания                                    |
| `GET /api/recipients/{handle}`                     | Получить `recipientSub`                                                               |
| `GET /api/accounts/me/entries?limit=20&cursor=...` | История с кнопками «Назад» и «Далее»                                                  |
| `POST /api/transfers`                              | `{ fromAccountId, recipientSub, amountKopecks, currency: "RUB" }` и `Idempotency-Key` |
| `GET /api/transfers/{id}`                          | Опрос до `COMPLETED` или `REJECTED`                                                   |

Сумма вводится в рублях с точкой или запятой, затем переводится в целое число копеек без округления. Баланс обновляется после подтверждённого результата. Ответ `202` показывает ожидание, а не успешный перевод.

Для каждого нового перевода создаётся UUID v4. После неопределённого результата POST кнопка повтора отправляет исходное тело с тем же ключом. Текущая заявка и её статус сохраняются в `sessionStorage` отдельно для каждого пользователя, чтобы продолжить в той же вкладке после обновления или повторного входа. Автоматических повторов POST нет. После 30 суток старый запрос не отправляется повторно. Если хранилище браузера отключено, сохранение действует только до обновления страницы. Токены в это хранилище не записываются.

Ошибки API читаются из Problem Details (`detail`, `code`); при опросе учитывается `Retry-After`. При отдельном origin gateway должен разрешить CORS для адреса фронта, заголовков `Authorization`, `Content-Type`, `Idempotency-Key` и открыть для браузера `Retry-After` через `Access-Control-Expose-Headers`.

## Проверки и сборка

```bash
npm test
npm run lint
npm run format:check
npm run build
npm run preview
```

`npm test` проверяет разбор денежных сумм и граничные значения. `npm run lint` запускает ESLint, `npm run format:check` — Prettier. Автоформатирование: `npm run format`. `npm run build` проверяет TypeScript и создаёт `dist/`. В CI используйте `npm ci` с сохранённым `package-lock.json`.

Для VPS раздавайте `dist/` через Caddy/nginx и направляйте `/api/*` на gateway. Настройки `VITE_*` фиксируются при сборке: перед production-сборкой укажите адреса VPS, затем выполните `npm run build`. `npm run preview` предназначен для локальной проверки. Демо-сборка выполняется отдельно командой `npm run build:demo` и не должна подменять обычную сборку.

## Файлы

- `src/App.tsx` — вход, создание и отображение счёта.
- `src/TransferForm.tsx` — поиск получателя, отправка и статус перевода.
- `src/History.tsx` — история и пагинация.
- `src/api.ts` — шесть HTTP-маршрутов и обработка ошибок.
- `src/auth.ts` — подключение Keycloak.
- `src/types.ts` — DTO по ТЗ.
- `src/money.ts` — ввод и отображение сумм.
- `src/demo.ts` — изолированный демонстрационный API.
- `src/styles.css` — небольшие дополнения к Bootstrap.

Документация зависимостей: [Vite](https://vite.dev/guide/), [Bootstrap](https://getbootstrap.com/docs/5.3/getting-started/introduction/), [Keycloak JS](https://www.keycloak.org/securing-apps/javascript-adapter).
