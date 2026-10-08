# Защита офлайн-загрузок: подготовленный релиз

Ветка: `feature/offline-download-protection`.
Код и тесты подготовлены. Обновление 1.0.1 использует отдельный живой защищённый Worker `speed-camera-protected`; см. `release-1.0.1.md`. Старые production endpoints и Supabase доступ не переключались. Сборки в магазины не отправлялись. Коллектор, source registry, storage migration и `main` не менялись.

## Пользовательский сценарий

- Максимум две скачанные страны. Новые загрузки идут по одной; выбора нескольких стран и batch-download больше нет.
- Третья страна: удалить одну из сохранённых или отменить. Во время активной поездки замена запрещена.
- Обновление существующей страны и восстановление повреждённого cache не расходуют новый слот.
- Состояния: Скачать / Скачано / Актуально / Обновить / Удалить; счётчик «Скачанные страны 2/2».
- Выбор страны проверяет metadata, а не автоматически скачивает dataset.
- Удаление локальное и атомарное. Освобождение серверного слота сохраняется в `pendingReleases` и повторяется перед следующей загрузкой, если сеть была недоступна.
- Уже существующий legacy cache с >2 странами не удаляется без согласия пользователя. Новые загрузки блокируются до ручного сокращения cache; UI показывает фактический счётчик и пояснение.

## Authorization и лимиты

`cloudflare/camera-data/worker.mjs`, `authorization.mjs`, `security-policy.mjs`, `rate-limiter.mjs`.

- HMAC-SHA256: `DOWNLOAD_SIGNING_SECRET` только в Worker secret. В приложении нет ключа подписи.
- Случайный UUIDv4 создаётся `expo-crypto.randomUUID()` при первом запуске и хранится в AsyncStorage (`camera_installation_v1`). Нет IMEI, рекламного ID или аппаратного идентификатора. Одновременная инициализация защищена от гонки.
- Токен привязан к installation, стране, checksum/version, поколению слота и сроку действия. TTL **300 секунд**; максимум **три попытки получения файла** одним токеном, включая повторы после обрыва связи. Удаление страны отзывает её токены.
- Durable Object с SQLite атомарно хранит два активных слота, rolling-лимиты и использованные токены; параллельные запросы не обходят счётчики.
- **4 новые разные страны за rolling 24 часа**. Обновление, ремонт и повтор страны, уже учтённой за эти сутки, не увеличивают этот счётчик.
- 30 запросов/минуту на installation: временная блокировка 15 минут.
- 8 ошибок авторизации/перебора за 10 минут: блокировка 30 минут.
- Мягкая защита общего IP: 180 запросов/минуту и максимум 30 разных installation за час; смена installation блокируется на 5 минут. Постоянных IP-блокировок нет; общий мобильный IP может временно попасть под ограничение.
- Ответы 429 содержат Retry-After. Security logs содержат причину и короткий HMAC-хэш, без исходных ID/IP, координат или токена. Неактивное состояние очищается через 30 дней.

Это барьер для массового скачивания, а не DRM: installation ID можно заменить после очистки приложения, IP — сменить, а уже полученный plaintext — скопировать. Сервер не может доказать удаление файла на чужом устройстве; лимит отражает протокол приложения. Attestation и аккаунты в этом этапе не добавлены.

## Маршруты после включения

Публичны только metadata `GET/HEAD /v2/manifest` и совместимый alias `/production/v1/manifest.json`, а также CORS OPTIONS. Manifest содержит code/name_key/count/version/checksum/size/date, опциональный geography_level и атрибуцию лицензии, **без country URLs или bucket keys**.

- `POST /v2/token`: X-Installation-ID, серверная проверка слотов и лимитов.
- `GET /v2/download/{country}`: X-Installation-ID + Bearer short-lived token.
- `DELETE /v2/countries/{country}`: освобождает только слот installation, не удаляет R2/DB данные.
- Старые `/countries/UA.json`, `/production/v1/countries/...`, immutable URLs и прямые `/protected/...` возвращают 404.
- Supabase `camera-export` становится совместимым прокси к тому же защищённому Worker. Без токена — 401, смена страны в query не обходит подпись. Прямых DB запросов в функции нет.
- SQL `supabase/offline_delivery_access.sql` закрывает anon/authenticated чтение camera_records/camera_sources. Metadata coverage остаётся публичной. Привилегии `camera_bootstrap` сохранены.

**Фактическое состояние до deployment:** R2 bucket уже private (managed public domain отключён, custom domains отсутствуют), но старый Worker country-export, старая Supabase function v4 и anon/authenticated SELECT ещё доступны. Не считать production защищённым на основании этого commit.

## Минимальные данные и offline

`export-projection.mjs` — отдельная read-only проекция, не изменение collector pipeline. Выгружаются canonical ID, координаты, тип, лимит, направление, дорожные поля/название для предупреждения и координаты концов участков. Служебные provenance/raw source IDs/confidence/import/moderation поля исключены. Польские red-light records проецируются в физические sites; endpoints средней скорости сохранены.

На текущем локальном snapshot подготовлено **122 downloadable datasets / 113108 пригодных warning records**. Это число datasets, не число стран: geography hierarchy и фильтр слабого покрытия UI сохранены. Подготовленные файлы находятся в игнорируемом `build/protected-delivery/objects`, не в Git, не опубликованы. После завершения параллельного сбора snapshot следует пересоздать.

Полученные bytes проверяются по SHA-256, размеру, count, IDs и координатам до атомарного сохранения chunked cache. Запуск offline использует проверенный cache, затем bundled UA/PL; публичный Supabase не является обходным fallback. Warning engine, heading/direction, средняя скорость и голос используют локальные данные. Проверка manifest не является условием работы поездки.

## Проверки

- Настоящий локальный Workers runtime (Miniflare/workerd), private R2 и SQLite Durable Object: **1649 checks passed** на всех 122 подготовленных datasets.
- Первые две страны, третья 409, удаление/замена, обновление, retry budget и параллельная гонка; подпись/expired/cross-country/cross-installation; enumeration/429/IP rotation; минимальный manifest/export; настоящий mobile delivery client и защищённый Supabase proxy.
- Offline UA/PL/DE/FR/US/CA: cache записан на диск, новый storage после рестарта, foreground GPS callback и background warning, локальная речь, **0 сетевых запросов**. Польская средняя скорость проверена из cache. Это автоматическая проверка; physical-device airplane test ещё не выполнен.
- App smoke, driver engine, product presentation, Android map, premium UI и map UI passed. Worker TypeScript check и Wrangler dry-run passed. Expo export iOS/Android passed; это проверка bundling, не EAS/store build.
- Изолированные server dev dependencies: npm audit 0 vulnerabilities. Существующие зависимости мобильного проекта отдельно не обновлялись, кроме необходимого expo-crypto.

Повторение на fresh checkout: `npm ci`, `npm --prefix cloudflare/camera-data ci`, `npm run test:delivery`, `npm run test:offline-warning`. Если полный snapshot отсутствует, автоматически создаются шесть маленьких representative fixtures из `mobile-tests/fixtures`; **никогда не публиковать их**. Для проверки полного snapshot сначала выполнить `node scripts/build_protected_delivery.mjs /path/to/r2-migration`.

## Будущее включение, не выполнено в этом задании

1. Дождаться окончания collector и проверить, что внутренние инструменты больше не зависят от публичного legacy export/anon SELECT. Проверить все публичные views/RPC на обход чтения camera_records перед SQL cutover.
2. Пересоздать защищённую проекцию из финального snapshot, сверить count/SHA и загрузить только `protected/v2/countries/...` в private R2. Manifest опубликовать последним. Не менять существующий сбор/registry/storage migration; protected publication — отдельная release operation.
3. Установить server secret через `wrangler secret put DOWNLOAD_SIGNING_SECRET`; не записывать значение в код, log или mobile environment.
4. Deploy Worker с binding DOWNLOAD_LIMITER и SQLite migration из wrangler.jsonc. Проверить private bucket, новые endpoints, прямые URL 404, expiry и 429 на production.
5. Deploy защищённый Supabase proxy, затем применить подготовленный SQL и проверить отсутствие REST/view/RPC обходов, сохранённые collector privileges и metadata coverage.
6. Выпустить совместимый клиент после серверной активации. До неё новые protected downloads в этой ветке fail closed; существующий cache и bundled UA/PL работают. Старые версии без tokens потеряют online download/update после cutover — это сознательная несовместимость security release.
7. На физических iPhone/Android скачать две страны, перезапустить в airplane mode и проверить GPS/голос, удаление/замену, обрыв сети и обновление. Store submission — отдельное действие, не часть этого задания.
