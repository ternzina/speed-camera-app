# Premium UI visual assets

Generated for this project with the built-in imagegen tool (two generate calls, opaque backgrounds). No image API keys, third-party logos or text embedded in backgrounds. Images are copied into the repository and bundled by Expo; they do not need a network request.

| Asset | Pixels | Usage |
|---|---|---|
| hero-road.jpg | 852 × 1846 | Native landing, cover |
| warning-road.png | 851 × 1848 | Full-screen warning, cover |

Generation briefs: premium photorealistic portrait road scene, approximately 9:19.5. Hero: winding clean two-lane mountain road at dusk, forest, peach/blue sky, restrained roadside lights, perspective and dark asphalt foreground; no people, vehicles, branding or text. Warning: countryside mountain road at blue hour, navy sky, forest silhouettes, orange horizon, restrained warm lights and dark foreground; no UI, logos, people, dashboard or foreground vehicles. Dark overlays and all text are native UI layers.

`icons/{camera,red-light,average-speed,combined,mobile}.svg` are editable, code-native vector sources. Runtime native UI uses the existing Feather icon family; Android map uses local inline SVG glyphs. No new icon dependency was added.

`flags/{ua,pl,de,fr,ca,us}.svg` are editable vector references. Runtime country labels continue using platform flag glyphs for the full localized country catalog, rather than requiring remote flag images. SVG sources are not loaded as native image files. The existing `assets/icon.png` remains the application icon.

Landing background converted from PNG to JPEG quality 82 at the original resolution (852 × 1846), approximately 392 KiB instead of 2.3 MiB. The previous source can be recovered from Git history.
