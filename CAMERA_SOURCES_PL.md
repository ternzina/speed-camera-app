# CamAlert Live Cameras: Poland source check

Checked 10 October 2026 (Europe/Kyiv). This note records public-page checks and legal boundaries; it is not a license opinion.

## Findings

- GDDKiA's official road-information map says it presents current disruptions and camera images for selected roads. The rendered page did not expose a public camera API or a downloadable camera catalog. A direct normal browser visit currently returns an Imperva security-check page. We did not solve it or inspect protected endpoints.
- GDDKiA's published 2018 XML handoff specification describes camera-point metadata (ID, name, district, road number, kilometer, coordinates, owner, cameras/direction) and image records (camera ID/number, capture time, image URL). It is a supplier-to-GDDKiA publishing interface, not evidence of a public consumer API. It also says images are JPEG-like hosted images called by GDDKiA, and asks suppliers to keep URLs accessible for 24 hours. It does not confer rights to reuse third-party camera images.
- GDDKiA's public-sector information reuse page says public-sector information may be reused commercially. However, gov.pl's site-wide terms state that audiovisual materials, including photos and video, are CC BY-NC-ND 4.0 by default unless a specific item says otherwise. A commercial CamAlert subscription therefore cannot rely on that general statement for camera frames. Written item-specific terms or a direct license from GDDKiA/each image owner are needed before embedding frames.
- AmberOne (Gdańsk Transport Company, A1 concessionaire) has an official public camera section titled “A1 na żywo” with four user-selectable views: PPO Nowa Wieś entry/exit and PPO Rusocin entry/exit. The links return individual JPEG images, not a continuous video stream. The page/source exposes no per-frame capture timestamp; its rotating-view countdown is not evidence of image capture cadence. No commercial reuse license was found on the page, so permission from GTC is still required.
- The four AmberOne images responded `200 image/jpeg` at 640×480. Their HTTP `Last-Modified` headers during the check were 10 Oct 2026 19:49:24 UTC (both Nowa Wieś views), 19:50:10 UTC (Rusocin entry), and 19:50:11 UTC (Rusocin exit). These are server file modification times; the page does not say they are camera capture times. The image response also advertises `Cache-Control: public, max-age=10368000` (120 days), while the official page appends a timestamp query parameter. A third-party app cannot assume a bare URL refreshes the frame promptly or copy that cache strategy without provider guidance.
- KPD's public DATEX catalog exposes road-event metadata and other road datasets, but does not list a public camera-frame feed. Listed SOAP feeds require registration and client-certificate authentication. No public camera-image API was established.
- The public TRAX Elektronik camera page returned a specific A4 point (Bojków, 309.928 km) but explicitly said “Punkt kamerowy ZABLOKOWANY” and that the user lacks permission. That image was not opened or accessed. This is a closed feed and is excluded.
- An independent camera directory links out to image sources, but it is an aggregator, not the camera owner, and no commercial redistribution license was found. Its displayed image examples do not establish frame freshness or grant reuse rights.

## Camera spot checks

| Road / candidate | What the public check established | Frame status / freshness | Commercial use |
|---|---|---|---|
| A1 PPO Nowa Wieś entry | Official AmberOne camera panel links to a JPEG snapshot | HTTP 200, image/jpeg, 640×480; Last-Modified 10 Oct 2026 19:49:24 UTC. No capture time burned in/labelled on the frame | Not cleared; GTC permission needed |
| A1 PPO Nowa Wieś exit | Official AmberOne camera panel links to a JPEG snapshot | HTTP 200, image/jpeg, 640×480; same Last-Modified 10 Oct 2026 19:49:24 UTC. No capture timestamp shown | Not cleared; GTC permission needed |
| A1 PPO Rusocin entry | Official AmberOne camera panel links to a JPEG snapshot | HTTP 200, image/jpeg, 640×480; Last-Modified 10 Oct 2026 19:50:10 UTC. No capture timestamp shown | Not cleared; GTC permission needed |
| A1 PPO Rusocin exit | Official AmberOne camera panel links to a JPEG snapshot | HTTP 200, image/jpeg, 640×480; Last-Modified 10 Oct 2026 19:50:11 UTC. No capture timestamp shown | Not cleared; GTC permission needed |
| A2 | A2 directory page lists camera locations; it explicitly says several candidates had no image on 10–12 Jan 2025 | Availability is mixed/uncertain and notes are stale; current frame not verified | Not cleared |
| A4 Gliwice / Bojków | Directory page identifies the A4 camera; linked TRAX record identifies Bojków A4, km 309.928 | TRAX labels the point locked; inaccessible to an unauthenticated user | Excluded; do not access |
| S7 | Gdańsk directory page lists several named S7 candidate points and source URLs | No current frame timestamp/content independently verified | Not cleared |
| S8 | Listed as a road category by the independent directory | No individual current frame verified in this audit | Not cleared |

**Count:** 5 requested road catalogs reviewed (A1, A2, A4, S7, S8); **4 actual still-image cameras on A1 were verified accessible and recently updated by the HTTP Last-Modified header**. The header is a server file timestamp, not an explicit camera capture time, and should not be presented as a capture timestamp without confirmation from GTC. No video stream was verified. Of these 4 working image sources, **0 are cleared for commercial reuse**. The other four roads have leads but no verified current frames in this audit. The linked A4 TRAX point is explicitly locked and was not accessed.

## Source conditions and next step

- Official map: [GDDKiA road-information map](https://drogi.gddkia.gov.pl/mapy/mapa-informacji-drogowej). It describes current road-camera images, but an API, published frame license, and direct downstream use terms were not verifiable.
- Official concessionaire alternative: [AmberOne A1 camera panel](https://a1.com.pl/kalkulator-oplat-i-planowanie-podrozy/#kamery). Four public JPEG views were verified, but the site provides no camera-feed API or explicit commercial redistribution license. Its “live” wording does not make these JPEGs video.
- Reuse policy: [GDDKiA public-sector information reuse](https://www.gov.pl/web/gddkia/ponowne-wykorzystanie-informacji-publicznej) and [gov.pl terms](https://www.gov.pl/web/gddkia/zasady-korzystania-z-logotypu-gddkia). Public text and audiovisual material have different default licenses.
- Technical supplier document: [GDDKiA XML camera/image handoff specification](https://www.gov.pl/attachment/fe1ecdf8-4738-4501-af47-692c234b0394). Useful schema only; it is not an access grant.
- KPD catalog: [DATEX metadata](https://kpd.gddkia.gov.pl/index.php/pl/metadane-datex/). Public catalog is not a public camera-image API.
- Secondary discovery only: [Portal Kamery Drogowe](https://kamerydrogowe.wlkp.net.pl/) and [TRAX Elektronik](https://www.traxelektronik.pl/pogoda/gddkia/). No content from either is bundled in CamAlert.

Before production, request from GDDKiA at kontakt@gddkia.gov.pl written answers on a commercial mobile-app license, permitted frame caching/refresh rate, API/feed access and attribution; request equivalent permission from GTC/AmberOne for A1 and any concessionaire or camera owner. Keep images off the client until those terms are clear.

## Demo implementation

The app ships only synthetic, vector-drawn demonstration scenes and sample map pins. They are persistently labelled DEMO and do not claim to show real camera locations or traffic. The UI has a separate observation-camera model, favorites, nearby sorting, separate map layer, per-selection rendering, refresh feedback, and stale/offline states for future licensed feeds. There is no live/video playback or background camera fetch.

## Expansion estimate

Planning estimate for one engineer, excluding legal fees and provider charges: 2–4 engineering days per country to identify owners, verify permission/API, map coordinates, build an adapter, and spot-check a representative sample; then 1–2 days per country for app-specific UI/configuration and QA once the shared model exists. A country with only restricted/unstable feeds can take 1–3 weeks of provider negotiation or remain unavailable. Each new country also needs ongoing source-health review (roughly 0.5–1 day/month per provider at small scale). No paid API costs can be estimated until commercial terms and refresh quotas are known.
