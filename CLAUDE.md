# LED Screen Content — project guide

Browser-only tools for event LED screens: abstract background images/videos and test patterns at any custom resolution. Plain HTML/CSS/JS, no build step, no server. Hosted on GitHub Pages from `main` (https://ghofransalem.github.io/led-test-pattern/); merging to `main` redeploys automatically.

The owner writes in Egyptian Arabic; reply in Arabic. They operate LED walls at events and play content in Resolume.

## Pages and files

| File | Purpose |
|---|---|
| `index.html`, `home.js` | Home page with tool picker; live previews on the cards. Old `index.html#w=…` links redirect to `abstract.html`. |
| `abstract.html`, `abstract.js` | Backgrounds tool: resolution, style (Animated / Static), palette, logo, event name, motion, PNG / MP4 export, screensaver section. |
| `generators.js` | All background styles (`STYLES`, each `{id, name, draw, kind}`), `PALETTES`, `render()`, grain. |
| `logo.js` | Logo load (SVG/PNG), layout rect, draw, upscale warning; stored in localStorage. |
| `text.js` | Event-name text overlay (fonts: Cairo, Tajawal, Almarai, Montserrat). |
| `anim.js` | Logo/text motion in videos (fade, slide, zoom, float, pulse). |
| `backdrop.js` | Frosted blur / darken panel behind the logo and the event name (`blur`, `dim` 0..1, trailing fields of the `logo` and `txt` hash values); call it inside `Anim.apply` before drawing the element. |
| `video.js` | MP4 (H.264) export via WebCodecs + `vendor/mp4-muxer.js` 5.2.1 (MIT). Chrome/Edge only. |
| `screensaver.html`, `screensaver.js` | Full-screen live player driven by the same URL hash; used with Lively Wallpaper (Windows) or WebViewScreenSaver (macOS). |
| `test-pattern.html`, `app.js`, `pattern.js` | Test-pattern tool: cabinets on by default, grid, bars, full fields, sending-card port chains drawn on the image. |
| `cabinets.js` | Shared "Calculate from cabinets" section for both tools: cabinet types by pixel pitch (+ user types in localStorage `ledsc.cabTypes`), screen size in meters → cabinets, pixels, area, weight, power, ports; `fileTag()` for filenames; `portChains()`. Hash keys `panel`, `cabKg`, `cabWatt` travel between the two pages. |
| `i18n.js` | All UI strings, English (default) and Arabic. |
| `save.js` | File download (plain link, or the claude.ai artifact `downloads` capability). |
| `style.css` | Shared dark "console" theme. |

## Rules that keep things working

- **Generators must loop seamlessly.** `draw(ctx, W, H, t, p)` with `t` in [0, 1). All motion uses whole numbers of cycles over `t` (e.g. `sin(TAU * t * p.speed * k)` or `frac(start + t * k)` with integer `k`), so `t=0` and `t=1` render identically. Static styles (`kind: 'static'`) ignore `t`.
- **Generators are resolution independent.** Positions are fractions of W/H; sizes are fractions of `m = min(W, H)`. Use the seeded `r()` from `prep(p)` for all randomness, called in the same order every frame.
- **Every UI string goes through `i18n.js`.** Static HTML uses `data-i18n`, `data-i18n-ph`, `data-i18n-aria`; scripts use `I18n.t('key', {vars})`. Add both English and Arabic. English is the default; the toggle switches to Arabic RTL.
- **Arabic layout:** never apply negative letter-spacing to Arabic text (it breaks letter joining). Wrap numbers and sizes inside Arabic sentences in LTR isolates (`⁦…⁩`). Use logical CSS properties (`margin-inline-start`, etc.).
- **Theme:** charcoal `#232324` canvas, `#0e0e10` nav, hairline borders, white pill buttons, Geist / Geist Mono (Cairo for Arabic). No accent colours in UI chrome; the aurora gradient is decoration only. Radii: 4 / 12 / 9999 px.
- **Downloads:** PNG via `canvas.toBlob`; filenames ASCII only (Arabic in filenames breaks downloads).
- **Video:** dimensions must be even for H.264 (odd sizes are padded with a black pixel and the user is told).

## Testing

No test framework. Use Playwright (pre-installed) against `file:///…/abstract.html` etc.:
- render every style at `t=0` and `t=1` and compare pixels (must be 0 different), and check static styles don't change;
- export PNG/MP4 and check with `ffprobe` (codec, size, frame count);
- check both languages, 1440 px and 390 px widths, no console errors, no horizontal scroll.

## Workflow and environment limits

- Work on a branch, open a PR, and merge only when the owner asks. The site redeploys from `main` (check the "pages build and deployment" run via `gh api repos/GhofranSalem/led-test-pattern/actions/runs`).
- Claude sessions cannot change repository settings (visibility, Pages) or create repos; ask the owner to do those in GitHub.
- `*.github.io` is blocked from the session's network, so the live site can't be opened from here; serve the same commit locally to test instead.
- A private preview is published at https://claude.ai/artifact/7XmudvAU6wq1SVcMak2xyJ (republish `index.html` with all files when asked).
