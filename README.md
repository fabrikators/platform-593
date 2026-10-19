# Platform 593 — scroll walk

A landing page that opens on the first-floor plan of Platform 593 (Achrafieh), walks into
the flat, out onto the terrace at sunset, and rises back to the plan. The plan is not an image: it is the 3D model from `Platform.lhzd`, cut at
1.20 m and seen from above through a 1° lens. three.js r170, GSAP 3.12.5 ScrollTrigger,
Lenis 1.1.13, plain files, no build step. Textures, HDRI and furniture are CC0
(ambientCG, Poly Haven).

## Run

    python3 tools/serve.py 8593      # then open http://127.0.0.1:8593

ES modules and textures need a server; opening `index.html` from disk will not work.

## Files

- `js/plan-data.js` — generated from the Live Home 3D model: `python3 tools/make_plan.py "<…>/Platform.lhzd" js/plan-data.js`
- `js/arch.js` — walls, openings, the black cut, floors, ceilings, glazing, doors, the floor inlay
- `js/sheet.js` — paper, room names, dimensions, door swings, title block
- `js/reveal.js` — the ink-to-material sweep (each room stays a drawing until the camera arrives)
- `js/camera.js` — the camera path: act 1 (sheet, descent, door, hall), act 2 (riding the black line, then the pergola terrace), act 3 (open terrace at sunset, the rise back to the sheet)
- `js/sky.js` — the sky stays paper until the open terrace, then the HDRI sunset dissolves in
- `js/furnish.js` — the hall staged as a gallery (direction A, "The line")
- `js/stage.js` — the shared scene (renderer, building, sheet, light, sky, ambient occlusion), used by every 3D page
- `js/interiors.js` — the kitchen and the south corridor as they stand in 2026, drawn from the photographs
- `walk2.html`, `js/walk2.js`, `js/walk2-route.js` — the second walk (below)
- `photos.html`, `js/photos.js`, `css/photos.css` — the 2026 photographs on the plan (below)
- `tools/record.cjs` — records the scroll frame by frame. The timeline runs t = 0…1 (act 1: sheet → hall), 1…2 (act 2: the line → pergola terrace), 2…3 (act 3: terrace, sunset, back to the sheet):
  `node tools/record.cjs video 26 30 0 1 checkpoint-1`, `… video 34 30 1 2 checkpoint-2`, `… video 26 30 2 3 checkpoint-3`, `… video 86 30 0 3 platform-593-walk`

Not in the model, added from the 2026 photographs: the balcony and kitchen windows, the
steel pergola over the pergola terrace and its planting. The 38.7 m² room is a terrace open to the
sky under a white steel pergola frame (as it stands in 2026; it was roofed in the past), so its
saw-tooth glazing became planters. It is called the "pergola terrace" / "terrasse sous pergola"
on every page (internally the room key is still `covered`); one hall glazing panel slides open and the
north planter has a 1 m gap onto the open terrace. The orientation of the sun is an assumption: it comes from plan-east (through the terrace
glazing), and the HDRI is rotated 63° so its sunset sits on the same bearing.

## The second walk (`walk2.html`)

The same model, another route: from the plan sheet the camera falls into the big room (the first
walk's closing rise, run backwards), turns to the balcony doors, crosses the hall along the north
windows, rounds the long wall, passes the front door, goes through the south strip into the kitchen
(two stops: the window run, then the south run), back out along the 8.5 m corridor and through the
glazed door onto the pergola terrace, then rises back to the sheet. One timeline p in [0, 1]; the
route, its look stops and its pace are in `js/walk2-route.js`. Captions in `js/i18n.js` (`walk2`).
The first walk links to it ("Walk 2" / "Promenade 2"), it links back, and the spaces page lists it.
Record it with `P593_URL='http://127.0.0.1:8593/walk2.html?capture&hud=0' node tools/record.cjs video 64 30 0 1 walk2`.

The kitchen and the corridor (`js/interiors.js`) replace the model's 2018 kitchen run, island and
closed cabinet, so they appear in both walks, on the plan sheet and in the photo map:
- the kitchen is a U of aubergine gloss units under a grey worktop: the window run on the west wall
  (sink), the south run (microwave, coffee machine, a tall unit in the corner) and the north run (gas
  hob, slim dishwasher) ending at the fridge; water coolers past the fridge; a long dark table with
  chairs. The window is 3.30 m wide on one mullion. Positions and sizes were solved jointly with the
  cameras of photos 61-65 (`tools/photo-registration/`); the fridge is the least certain (±0.2 m);
- the corridor is 1.15 m wide: a plain wall, then wooden side frames about 0.8 m apart holding glass
  shelves over a black base, under a bulkhead with lights; it ends at a glazed door onto the pergola
  terrace (in `tools/make_plan.py`, opening on the east glazing). Solved from photo 21.

## Beautiful spaces (`spaces.html`)

Platform 593 shown as one of the spaces connected to Fabrika, for organisations (NGOs first) looking
for a base for a team or a room for an event. It shows the space; it is deliberately not a listing:
no rent, terms or "to let" wording. Key figures, the areas and an interactive plan drawn from the
building model (`js/plan-data.js`, so they always match the walk), three indicative ways to use the
floor drawn on that plan (desks 140 × 70 cm; the desk count is counted from the drawing), the 2026
photographs with a lightbox, what is already in place, a panel on Fabrika, links into the 3D walk
and the photo map, and a contact form. English and French (`js/spaces-i18n.js`); the language
follows the rest of the site. Files: `spaces.html`, `css/spaces.css`, `js/spaces.js`.

- **`data/spaces.json`** holds the address, a map link, a link to Fabrika and the contact. Anything
  left `null` is simply not shown. Text takes both languages: `{"en": "…", "fr": "…"}`.
- **The contact form** opens the visitor's email app with the message written out, addressed to
  `contact.email`; with `contact.whatsapp` set (digits with country code) a WhatsApp button appears
  too. The site has no server, and the CSP forbids form posts (`form-action 'none'`). Until
  `contact.email` is filled in, the form says the contact details are coming.
- **Print a summary** (button on the page, or the browser's print) gives three A4 pages: summary,
  plan, what is here and Fabrika.
- **Download the plan** serves `assets/docs/platform-593-plan.pdf` (from `Platform-2c.pdf`).
- The Fabrika figures (founded 2016, 150+ organisations hosted, 2,000 m² over six levels) come from
  the company presentation; update them in `js/spaces-i18n.js`.
- The glass meeting room in the layouts is placed approximately (it is not in the 2024 model).

## Photographs, 2026 (`photos.html`)

The 23 photographs from `Photos 2026 nice`, each placed on the plan where it was taken, with
a cone for what the lens saw. A camera opens a viewer that lays the photograph over the bare
model (no staging, no door leaves) seen from the same spot, with a wipe between the two, or
the photograph above the model on a tall phone. Model / Drawing switches the comparison to the
line drawing. `photos.html#05` opens one photograph directly.

- Poses are in `data/photos.json` (x, y in plan metres; yaw 0 = plan east, 90 = plan north;
  pitch and roll; vertical fov; eye height h; shift = vertical lens shift: the photographs have
  corrected verticals, so their cameras are level and shifted, not tilted; iw, ih = image size).
- They were solved by least squares from landmarks picked in each photograph (wall corners,
  window jambs, the pillars, the black floor inlay) against the plan, the kitchen (61-64) and
  big room (31, 32) jointly with their unknown window sizes: `tools/photo-registration/`
  (`landmarks.json`, `solve.cjs`, `bundle.cjs`, `overlay.cjs` draws the model's edges over a
  photograph to check a pose). The same solve corrected the model: the kitchen, big-room and
  dressing windows, and the two pergola posts by the planter bay.
- The hall was re-planned after the 2024 model (a glass meeting room, glass shelving), so hall
  photographs carry a note; 05, 22 and 85 are approximate (dashed cones): the 2026 fittings hide
  too many of the model's walls.
- `photos.html?place` adds keyboard nudging in the viewer (arrows move, Q/E turn, R/F tilt,
  T/G lens shift, [ ] roll, Z/X lens, PgUp/PgDn height, Shift for bigger steps) and "Copy positions", which copies the
  whole `data/photos.json` to the clipboard.
- Images: `assets/photos/` (1600 px) and `assets/photos/thumbs/` (360 px), made with
  `magick <src> -auto-orient -resize '1600x1600>' -strip -quality 82 -interlace JPEG`.

## Languages

English and French, from `js/i18n.js` (page text, captions and every word on the sheet).
The page follows `?lang=en|fr`, then the visitor's last choice, then the browser language;
the EN · FR switch relabels the sheet in place.

## Online (GitHub Pages)

The two walks and the photo map are live at https://fabrikators.github.io/platform-593/
(walk 1), `walk2.html` (walk 2) and `photos.html`, published from the public repository
fabrikators/platform-593 by `.github/workflows/pages.yml` on every push to `main`. The workflow
serves only those three pages and their files. Madi's archive is never committed (`.gitignore`),
and neither are the recordings in `out/`. GitHub Pages sends no custom headers, so the CSP in
`deploy/security-headers.conf` applies only to the Coolify deployment below.

## Deploy (Coolify)

The `Dockerfile` serves the plain files with nginx (`deploy/nginx.conf`): correct types for
`.gltf`/`.hdr`/`.bin`, gzip, one-week caching for `assets/`, revalidation for the page, and
the security headers in `deploy/security-headers.conf` (CSP included). No environment
variables and no volume are needed. In Coolify: new resource → this repository → build pack
"Dockerfile" → port 80 → health check path `/healthz`.

- Both pages carry the same inline import map. If it changes, change it in `index.html` and `photos.html` alike and run `python3 tools/csp_hash.py`, which checks they match and updates the CSP hash.
- `out/` (recordings) and `tools/` are excluded from the image by `.dockerignore`.
- `og:image` is relative; once the domain is known, make it absolute (`https://…/assets/og.jpg`).
- Check the production headers locally with `python3 tools/serve.py 8595 --prod`.

## Platform, 1988–89 (`?archive`)

Platform was a gallery in this flat. With `?archive`, the hall carries Hussein Madi's four
shows there, hung in the order they opened along the ride on the black line, each with its
poster and an EN/FR wall label: sculptures (30 November 1988) on the column by the plinths,
pastels and watercolours (14 December 1988) on the serpentine partition, drawings and prints
(25 January 1989) on the west wall, paintings (15 February 1989) on the long lobe wall.
Act 2 then becomes a timeline: the camera pauses to face each show (`ACT2A` in
`js/camera.js`), a strip at the top marks the four dates, and each show has its caption.
The images are in `assets/archive/`, cut from the poster scans in
`Platform 593/Platform Gallery/`.

They are Madi's works and stay private: `.dockerignore` keeps `assets/archive` out of the
image, so on the live site `?archive` falls back to the colour fields. When the estate
agrees, delete that line in `.dockerignore` and redeploy.

The Platform signature (`assets/brand/signature.png`, from the same posters) is the page
mark and heads the title block in every mode.
