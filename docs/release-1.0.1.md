# CamAlert 1.0.1 — тестовый релиз

Ветка `feature/offline-download-protection`, без изменения main/collector/source registry/storage migration.

Версия 1.0.1, iOS build 15, Android versionCode 7. Включены последний UI, тонкое кольцо скорости, однострочный заголовок/стрелка назад, JPEG-фон ~400 KB, исправления dark mode и лимит двух офлайн-стран.

## Совместимость сервера

Тестовый клиент использует **https://speed-camera-protected.ternzina.workers.dev**. Worker, R2 protected exports и SQLite DownloadLimiter действительно включены; server-only signing secret создан на серверной стороне deployment, не попал в Git/mobile bundle. Временный upload-only publisher после передачи 122 datasets удалён. Проекция опубликована отдельным release-действием, pipeline не менялся.

На живом endpoint проверены UA/PL/DE/FR/US/CA: HTTP 200, SHA-256/размер совпадают. Третья страна 409, подмена страны в токене 401, постоянные прямые URLs 404. Передача minimal datasets оставляет прежние Master records неизменными.

**Старый speed-camera-data Worker, Supabase camera-export и таблицы не закрыты в этом тестовом rollout**, чтобы не прерывать legacy клиенты и collector. Защита нового endpoint работает, но полный anti-scraping cutover всех старых путей ещё не выполнен. Полный cutover описан в offline-download-protection.md и требует отдельной координации.

## Артефакты

- iOS: локальный Xcode archive/export succeeded; IPA содержит 1.0.1 (15), JPEG-фон и новый endpoint.
- IPA: `build/ios-testflight-15/CamAlert.ipa`, копия `~/Downloads/CamAlert-1.0.1-15.ipa`.
- EAS Submit iOS ID: `14c3b8c5-c50a-4bb6-b6fe-3557a60d22f7` — FINISHED. App Store Connect показывает 1.0.1 (15), обработка Apple.
- Android EAS Build ID: `6e71ab23-9456-46e5-972e-b055975d2a58` — сборка запущена, результат будет записан после завершения.
- Публичный App Store/Google Play production rollout не запускался. Цель по предыдущему сценарию — TestFlight и internal testing.

1649 локальных Workers security checks passed; повторные tests с новым endpoint пройдены. Offline warning regression UA/PL/DE/FR/US/CA — 0 network requests. Physical-device airplane test остаётся проверкой перед широким выпуском.
