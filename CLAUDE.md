# LED Screen Content — project guide

Browser-only tools for event LED screens: abstract background images/videos and test patterns at any custom resolution. Plain HTML/CSS/JS, no build step, no server. Hosted on GitHub Pages from `main` (https://ghofransalem.github.io/led-test-pattern/); merging to `main` redeploys automatically.

The owner writes in Egyptian Arabic; reply in Arabic. They operate LED walls at events and play content in Resolume.

## Pages and files

| File | Purpose |
|---|---|
| `index.html`, `home.js` | Home page with tool picker; live previews on the cards. Old `index.html#w=…` links redirect to `abstract.html`. |
| `abstract.html`, `abstract.js` | Backgrounds tool: resolution, style (Animated / Static), palette, logo, event name, motion, PNG / MP4 export, screensaver section. |
| `generators.js` | All background styles (`STYLES`, each `{id, name, draw, kind}`), `PALETTES`, `render()`, grain. Static styles use `prepS(p)`: seeded palette shuffle, `sc` from `p.scale` (size) and `k` from `p.glow` (light); 0.5 is the default look. |
| `logo.js` | Logo load (SVG/PNG), layout rect, draw, upscale warning; stored in localStorage. |
| `text.js` | Event-name text overlay (fonts: Cairo, Tajawal, Almarai, Montserrat). |
| `anim.js` | Logo/text motion in videos (fade, slide, zoom, float, pulse). |
| `backdrop.js` | Glass panel behind the logo and the event name: mode off / box / full-width band, blur, darken, shine, fade (none, all, t, b, l, r, tb, lr) + fade size. Trailing fields of the `logo` and `txt` hash values via `Backdrop.serialize/parse` (older blur/dim-only links still parse); call `draw` inside `Anim.apply` before drawing the element. |
| `video.js` | MP4 (H.264) export via WebCodecs + `vendor/mp4-muxer.js` 5.2.1 (MIT). Chrome/Edge only. Quality `vq` (hash key) = std / high / max → 0.25 / 0.5 / 1 bits per pixel per frame, 15–240 Mbps; thin-line styles smear below ~0.5. |
| `screensaver.html`, `screensaver.js` | Full-screen live player driven by the same URL hash; used with Lively Wallpaper (Windows) or WebViewScreenSaver (macOS). |
| `test-pattern.html`, `app.js`, `pattern.js` | Test-pattern tool: cabinets on by default, grid, bars, full fields, sending-card port chains drawn on the image. |
| `project.js` | Project model shared by the test-pattern and report pages: localStorage `ledsc.project` = `{v:1, name, client, date, sel, screens:[{id, name, state, type}], elec:{volts, breaker, usable, avgPct, pf}, spare, media:{…}, report:{data, power, packing, media}}` (`state` = the test-pattern form state, same keys as a saved preset; `type` = cabinet-type snapshot so custom types survive export). `ledsc.company` = `{name, address, phone, email, footer, logo(data URL ≤ 500 KB)}`. `compute(screen, project)` = all report numbers (power, circuits as contiguous snake runs, ports via `Cabinets.portChains`, links). Export/import file `{type:'ledsc-project', v:1, project, company}`. |
| `report.html`, `report.js`, `report.css` | PDF report: the project as A4 pages (cover + summary + to-scale overview, 1–2 pages per screen with SVG cabinet maps for data and power, packing list, media server page). Printed with `window.print()`; the left panel holds the report settings (company, power, spares, media, sections). |
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
- **Projects (test-pattern page):** without a project the page behaves exactly as before (no storage writes, same hash, same PNG). With one, every form change is written to the selected screen (debounced; `commit()` re-reads storage first so report-page edits in another tab survive). A hash link that differs from the selected screen is added as a new screen, never overwrites one.
- **Report layout:** pages are real A4 boxes in mm (`.page`, `.page.landscape` = named page `landscape`), measured in the browser by `Flow` in `report.js`: blocks move to the next page when they don't fit, tables split between rows (header repeats, "continued" caption), maps are sized to the space left or start a fresh page (`addMapSection`). Long screens go landscape and/or split into stacked parts (`mapGeom`, target cabinet ≥ 6.5 mm on paper); maps use a real drawing scale (1:50, 1:75…). The paper uses its own fixed colours and fonts (not the UI variables), so any UI theme prints the same. Check every change with `page.pdf({preferCSSPageSize:true})` in EN and AR: page count = number of `.page` elements (no blank pages), and nothing overflows a page body.
- **Electrical model (report):** peak = cabinets × max W; average = peak × avgPct; I = P ÷ (V × PF); circuit capacity = V × PF × breaker × usable %; circuits = ⌈cabinets ÷ ⌊capacity ÷ W per cabinet⌋⌉, balanced contiguous runs along the data snake, phases L1–L3 in turn. Defaults 230 V, 16 A, 80 %, 35 %, PF 0.95.

## Testing

No test framework. Use Playwright (pre-installed) against `file:///…/abstract.html` etc.:
- render every style at `t=0` and `t=1` and compare pixels (must be 0 different), and check static styles don't change;
- export PNG/MP4 and check with `ffprobe` (codec, size, frame count);
- check both languages, 1440 px and 390 px widths, no console errors, no horizontal scroll;
- report: seed `ledsc.project` / `ledsc.company` in localStorage, open `report.html`, `page.pdf({preferCSSPageSize: true})` in EN and AR, then `pdfinfo` (page count and sizes), `pdftotext` (no empty pages) and `pdftoppm` to look at every page.

## Workflow and environment limits

- Work on a branch, open a PR, and merge only when the owner asks. The site redeploys from `main` (check the "pages build and deployment" run via `gh api repos/GhofranSalem/led-test-pattern/actions/runs`).
- Claude sessions cannot change repository settings (visibility, Pages) or create repos; ask the owner to do those in GitHub.
- `*.github.io` is blocked from the session's network, so the live site can't be opened from here; serve the same commit locally to test instead.
- A private preview is published at https://claude.ai/artifact/7XmudvAU6wq1SVcMak2xyJ (republish `index.html` with all files when asked).
