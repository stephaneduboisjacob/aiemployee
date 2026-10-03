# AI Employee OS visual asset plan

## Site audit

The live domain currently serves a setup page. The application in [page.tsx](../apps/web/src/app/page.tsx) is a single-page operations dashboard with Overview, Task inbox, Customers, Schedule, Employees, and Audit log views. Its overview runs top to bottom from the workspace sidebar and page header through metrics, employee cards, workflow activity, approvals, upcoming visits, audit history, and a footer.

The current visual system is mostly CSS, Lucide icons, and initials; there are no image assets in `apps/web/public`. The app has empty states and connection/error notices, but no dedicated About, testimonials, blog, marketing pricing, onboarding, or supervisor pages. The live domain’s setup page is not the app dashboard.

So this plan has two scopes: assets for the existing product UI, and a clearly marked marketing layer for when those pages exist. Product data, labels, charts, transcripts, and workflow states should remain real UI—not generated imagery.

## Master visual language

**Brand character:** a calm, precise operations platform for people who run field-service businesses. Futuristic through controlled information design and refined materials; trustworthy through real people, legible interfaces, and restrained effects.

**Palette**

- Carbon navy `#0B1220` and deep slate `#18253A` for dark brand fields and device renders.
- Porcelain `#F5F8FC` and clean white for product UI and light editorial space.
- Signal teal `#48D5C1` for connection, automation, and verified states.
- Cobalt `#5577F8` for primary actions and workflow focus.
- Service amber `#E9A968` for field warmth and approval attention.
- Cool slate `#8291A8` for secondary details.

Keep the app’s status colors meaningful. Use teal for successful/connected, amber for waiting/approval, and red only for errors. Avoid rainbow gradients and glowing everything.

**Rendering and materials:** cinematic editorial photography for people and HVAC work; precision 3D for abstract system visuals; straight-on or orthographic compositions for diagrams. Use satin graphite, brushed aluminum, porcelain ceramic, and small areas of smoked glass. Light with a soft neutral key, controlled teal/cobalt edge light, and a warm practical accent. Keep grain subtle, reflections clean, and contrast high enough for text overlays.

**Avoid:** humanoid robots, brains, floating code, neon circuit boards, fake interface text, fabricated logos, fake customer quotes, unsupported performance metrics, excessive glassmorphism, and “hacker” imagery.

**Reusable prompt prefix**

Paste this before an asset-specific prompt:

> Create a premium enterprise SaaS visual for AI Employee OS, an AI operations platform for HVAC field-service companies. Make the technology feel credible, secure, and already useful to a real service business. Use carbon navy, porcelain white, controlled signal teal, cobalt, and a small warm amber accent. Use refined cinematic lighting, realistic materials, precise geometry, restrained depth, and strong composition. Keep detail intentional and leave clear negative space when requested. No words, letters, numbers, logos, watermarks, fake dashboards, robots, brains, holographic clutter, or decorative circuit-board clichés. Deliver one clean composition, not a collage.

**Production rule:** AI-generated visuals must not replace screenshots or depict fake product features. Capture the real dashboard for product UI, and composite that screenshot into generated device mockups afterward. Use real, permissioned customer logos, team photos, and testimonials.

## P0 — Existing product UI

### 01. Brand mark and wordmark

**Location:** Sidebar, app header, login/onboarding when added, footer.\
**Purpose:** Establish a distinctive, ownable identity that feels operational and dependable.\
**Format:** Designer-redrawn vector; `apps/web/public/brand/ai-employee-os-mark.svg`, `wordmark.svg`; monochrome and light-on-dark variants. Design on a 1024×1024 artboard.\
**Prompt:**

> Using the AI Employee OS visual direction, explore a geometric brand symbol that combines a protected workflow path with a subtle “A” or linked-task idea. Create a compact mark with strong silhouette at 16 pixels, balanced negative space, and a precise enterprise character. Use a single deep-navy shape with an optional teal path accent. No literal robot, person, gear, brain, or shield stock symbol; no text in the symbol. Flat vector logo exploration on a plain white background, centered, crisp edges, suitable for clean SVG redraw.

### 02. Favicon and app icon family

**Location:** Browser tab, saved shortcut, mobile home-screen shortcut, onboarding.\
**Purpose:** Keep the product recognizable at small sizes.\
**Format:** `favicon.svg` and PNG exports at 48×48, 180×180, 192×192, 512×512; provide light and dark backgrounds.\
**Prompt:**

> Create a square app-icon study based on the approved AI Employee OS mark: one bold, simple geometric workflow glyph centered on a deep carbon-navy rounded square, a single restrained signal-teal connection detail, clean edge lighting, crisp vector-like geometry, no letters, no text, no micro-detail. It must read clearly at 32 pixels and remain polished at 512 pixels.

### 03. Digital employee role avatar suite

**Location:** Employee cards, Employees view, handoff/task rows, employee picker.\
**Purpose:** Give each digital employee a consistent identity without depicting them as fake human staff.\
**Format:** Five individual transparent PNG or WebP assets, 512×512; square crop; same camera, lighting, scale, and material treatment.\
**Prompt template:**

> Create one isolated premium 3D role glyph for an enterprise HVAC operations platform. Use a simple sculptural object on transparent background, centered with generous padding, satin porcelain and graphite materials, one controlled teal/cobalt detail, soft studio key and subtle warm rim light, precise product-render quality, no text, no people, no robot, no ground plane, no shadow extending to the canvas edge. This asset represents **[ROLE SYMBOL]**. Keep scale and visual weight consistent with the other role glyphs.

Create these five variants:

- Receptionist: a refined phone receiver with a short, clean sound-wave arc.
- Sales assistant: a folded quote document with one precise upward path.
- AR clerk: a balanced ledger tile with one completed payment marker.
- Support technician: a calibrated service wrench paired with a small diagnostic pulse.
- Purchasing assistant: two aligned supply crates with a single comparison tick.

### 04. Real human profile avatar guidance

**Location:** Owner/user menu, approver identity, human escalation cards.\
**Purpose:** Distinguish human decision-makers from digital employee roles.\
**Format:** User-uploaded photographs, 1:1 crop, 256×256 WebP; initials fallback in the UI.\
**Prompt:** No image-generation prompt. Use consented user photos or initials; do not create synthetic portraits that could be mistaken for real colleagues.

### 05. Subtle global texture

**Location:** Optional dark marketing hero, onboarding header, CTA backdrop; not behind dense dashboard tables.\
**Purpose:** Add depth without competing with content.\
**Format:** Seamless 2048×2048 WebP/AVIF, low contrast; CSS-tiled.\
**Prompt:**

> Seamless, low-contrast premium surface texture for an enterprise software brand: near-black navy with extremely subtle precision topographic contours and a sparse fine-grain finish, faint cool-teal light only at the outer edges, no focal point, no symbols, no text, no obvious grid, evenly tileable in every direction, elegant and almost invisible behind interface content.

### 06. Product dashboard device composition

**Location:** Marketing hero or product-tour section; not inside the working dashboard.\
**Purpose:** Show the real platform while adding cinematic framing.\
**Format:** 2400×1500 WebP, with the display area unobstructed for compositing a real screenshot.\
**Prompt:**

> Render a premium graphite desktop display and slim tablet as a restrained 3/4 product still life, angled slightly toward camera, on a dark navy studio surface. The monitor and tablet screens must be perfectly flat, blank, evenly lit porcelain-white rectangles with no interface, no marks, no text, no reflections obscuring the screens. Add a subtle teal edge light and a warm amber practical reflection, soft realistic shadow, medium 50mm lens, controlled depth of field, broad negative space around the devices. We will composite genuine AI Employee OS screenshots onto the screens.

### 07. Overview workflow idle illustration

**Location:** Overview → Workflow activity when no workflow has run.\
**Purpose:** Explain that a call becomes coordinated work, without feeling like an error or an empty database.\
**Format:** Transparent WebP or SVG redraw; 800×560.\
**Prompt:**

> Create a compact, transparent-background 3D illustration of a clear service workflow: a simple phone glyph connects through three small precise nodes to a calendar tile, then a quote sheet, then a completed handoff marker. Use a straight left-to-right route with ample spacing, porcelain and graphite forms, a thin teal route line, one cobalt focus node, and one small amber approval point. Soft studio lighting, orthographic camera, clean silhouette, no letters, labels, UI panels, or decorative orbit rings.

### 08. Task inbox empty state

**Location:** Task inbox → No pending approvals or handoffs.\
**Purpose:** Make an empty queue feel ready and reassuring, not inactive or broken.\
**Format:** Transparent WebP/SVG, 720×480.\
**Prompt:**

> Create a minimal premium illustration of an organized open work tray with one small teal completion marker and a subtle path leading into it. Porcelain ceramic and soft graphite, clean 3D geometry, orthographic view, soft neutral key light with a faint cobalt edge, warm and reassuring mood, wide negative space. No papers with text, no checklists, no words, no logos, no people.

### 09. Customer list empty state

**Location:** Customers → No customer records.\
**Purpose:** Show that customer memory grows from real interactions.\
**Format:** Transparent WebP/SVG, 720×480.\
**Prompt:**

> Create a minimal enterprise illustration of a small residential property marker connected by a fine teal line to two clean contact nodes, suggesting a service customer record being created from a real interaction. Use porcelain, graphite, muted cobalt, and one warm amber point; precise 3D object forms; orthographic camera; soft studio lighting; no faces, text, names, maps, pins with labels, or interface.

### 10. Schedule empty state

**Location:** Schedule → No visits booked.\
**Purpose:** Signal that the calendar is ready for the first booking.\
**Format:** Transparent WebP/SVG, 720×480.\
**Prompt:**

> Create a compact premium illustration of a porcelain calendar tile with a single service-visit marker represented by a small HVAC airflow symbol, connected to a precise cobalt time block. Use clean surfaces, soft neutral lighting, a small teal accent, gentle grounding shadow, and clear negative space. Orthographic product render, no numbers, no dates, no words, no full calendar UI.

### 11. Audit history empty/verified state

**Location:** Audit log → Empty history or verified-chain visual.\
**Purpose:** Convey traceability and integrity without making certification claims.\
**Format:** Transparent WebP/SVG, 720×480; separate empty and verified states may reuse the same art.\
**Prompt:**

> Create a restrained 3D illustration of several linked, precisely machined graphite data tiles forming an unbroken chain, with a subtle teal continuity light traveling across the links. Include no padlock, badge, certificate, or claim of compliance. Porcelain highlights, fine brushed-metal edges, soft studio lighting, orthographic camera, quiet trustworthy mood, transparent background, no symbols that resemble a vendor logo, no text.

### 12. Workflow retry and service-error illustration family

**Location:** API disconnected, workflow retrying, permission denied, and 404/500 pages when those states are designed.\
**Purpose:** Make failures legible and recoverable while preserving trust.\
**Format:** Four 720×480 transparent WebP/SVG variations from one visual family.\
**Prompt template:**

> Create a calm enterprise product-state illustration for **[STATE]**. Use a simple graphite and porcelain workflow object with one clear cobalt/amber/red state indicator as appropriate. Preserve the same soft lighting, restrained materials, orthographic camera, and generous negative space as the AI Employee OS illustration suite. The feeling is “visible and recoverable,” not alarming. No text, warning triangles, glitch effects, broken glass, or fake interface.

Variants: API reconnecting (teal path reconnecting), workflow retry (one paused route with a retry loop), access restricted (closed path with a clear alternate route), not found (path ends at a clean empty space).

### 13. Onboarding and integration setup hero

**Location:** Future onboarding wizard: connect phone, email, calendar, CRM; hire first employee; run test call.\
**Purpose:** Make setup feel guided and controlled.\
**Format:** 1600×1000 WebP, plus 4 individual 512×512 channel glyphs if the wizard needs illustrations.\
**Prompt:**

> Create a premium isometric still life showing four separate connected service objects—phone receiver, email envelope, calendar tile, and CRM contact card—arranged around one central graphite workspace hub. Fine teal connection paths, cobalt focus point, warm amber visit marker; porcelain and brushed-aluminum materials; soft studio lighting; generous whitespace; clear geometry; no readable text, app logos, screens, or floating holograms.

### 14. Future live-call supervisor scene

**Location:** Future Supervisor view showing active calls and transcript monitoring.\
**Purpose:** Give the voice operations area a focused, calm visual identity.\
**Format:** 1800×1200 WebP; use as a page illustration or demo-tour cover, not as the live waveform itself.\
**Prompt:**

> Create a premium 3D scene for a call supervisor console: a real understated headset rests beside a slim dark audio control surface, with a single clean teal waveform reflected across a smoked-glass strip and one warm amber escalation light. Carbon navy background, porcelain highlights, subtle brushed-metal detail, softbox lighting, 50mm product-photography lens, negative space at upper left. No people, readable transcript, fake controls, neon, or sci-fi holograms.

## P1 — Public marketing layer (not present in the current app)

### 15. Landing-page hero image

**Location:** Future marketing homepage, above the fold.\
**Purpose:** In one frame, connect AI coordination with real HVAC service work and human oversight.\
**Format:** 2560×1600 master; prepare 1600×2000 mobile crop.\
**Prompt:**

> Create a cinematic editorial photograph for a premium HVAC operations platform. A capable residential HVAC technician in clean, authentic workwear stands at the right third of frame beside a real outdoor condenser at a well-kept Austin-area home, reviewing a slim tablet. Show real equipment detail and a confident, natural expression; no posed stock-photo smile. Late-afternoon warm light on the home, cool navy shade and subtle teal reflections near the tablet, polished enterprise mood, realistic skin and materials, 35mm lens, crisp subject, soft background. Leave the left 42 percent dark and uncluttered for headline and buttons. No visible company marks, text, fake UI, robots, or holograms.

### 16. Orchestration feature visual

**Location:** Marketing feature section: inbound call → booked visit → quote → follow-up → salesperson.\
**Purpose:** Make the end-to-end workflow the product’s central differentiator.\
**Format:** 1800×1200 WebP, 3:2.\
**Prompt:**

> Create a refined orthographic 3D process visualization showing a phone glyph flowing into a service appointment tile, a quote sheet, a follow-up marker, and a human handoff node. Connect each object with one precise teal route; use cobalt for the current step and amber for human review. Arrange as a spacious left-to-right composition with clear visual hierarchy, porcelain and graphite materials, soft neutral studio light, clean negative space, no words, numbers, fake dashboard, or circuitry.

### 17. Shared company memory visual

**Location:** Marketing feature section: controlled company memory.\
**Purpose:** Show customer, property, equipment, service history, and policy as connected context with permissions.\
**Format:** 1600×1200 WebP, 4:3.\
**Prompt:**

> Create a premium 3D visualization of a central residential HVAC equipment model connected to a small set of distinct information objects: customer profile silhouette, property outline, service-history tile, pricing rule tile, and policy node. Use thin, intentional teal connectors, one muted cobalt access boundary, porcelain and graphite materials, soft directional lighting, orthographic perspective, orderly spacing, no glowing brain, no data cloud cliché, no labels, letters, or fake interface.

### 18. Approvals and audit trust visual

**Location:** Marketing feature section: human approval and immutable audit history.\
**Purpose:** Communicate that consequential actions have policy gates and traceable decisions.\
**Format:** 1600×1200 WebP, 4:3.\
**Prompt:**

> Create a precise product-like still life of a quote sheet paused at a clear approval gate, followed by a short chain of linked audit tiles. One warm amber approval point transitions into a teal verified route. Graphite, porcelain, brushed metal, one restrained smoked-glass element, soft cinematic key light and subtle teal rim. Stable, boardroom-appropriate, no padlock clichés, certification badges, legal seals, readable text, or claims.

### 19. Unified channels visual

**Location:** Marketing feature section: phone, email, calendar, CRM, web chat.\
**Purpose:** Show that company-owned channels become one interaction record.\
**Format:** 1600×1200 WebP, 4:3.\
**Prompt:**

> Create a balanced isometric composition of five clean channel objects—a phone receiver, envelope, calendar block, contact card, and small chat bubble—converging into one central interaction tile. Use porcelain and graphite forms with thin teal connectors and a controlled cobalt center accent. Soft studio lighting, elegant spacing, precise geometry, credible enterprise product render, no brand logos, text, floating code, or glowing network web.

### 20. HVAC expertise editorial photo suite

**Location:** Industry specialization, use cases, case-study pages, and resource cards.\
**Purpose:** Prove the product understands real residential service operations.\
**Format:** Three 2400×1600 editorial photographs; landscape 3:2; crop variants as needed.\
**Prompt template:**

> Create an authentic editorial photograph for a premium residential HVAC operations platform: **[SCENE]**. Use real HVAC tools and equipment, credible workwear and safety practice, clean but lived-in residential setting, natural human posture, late-afternoon warm practical light balanced by cool neutral shadows, subtle teal/cobalt color grade, 35mm documentary lens, high detail without advertising gloss. No visible brand logos, staged handshake, fake screens, text, or futuristic equipment.

Scenes: technician diagnosing an outdoor condenser; dispatcher reviewing a service route; technician explaining a completed repair to a homeowner.

### 21. Customer proof and testimonial backgrounds

**Location:** Future case studies, testimonials, customer logo strip.\
**Purpose:** Add evidence and warmth without fabricating customer credibility.\
**Format:** Optional 1600×900 backgrounds; customer logos supplied separately as approved SVGs.\
**Prompt:**

> Create a quiet, softly focused background photograph of a real-feeling HVAC service office: clean workbench, neatly organized tools, route board out of focus with no readable text, warm daylight, cool navy shadows, a subtle teal reflection, documentary realism, understated and trustworthy, broad uncluttered center area for an overlaid customer quote. No people, signage, logos, text, invented metrics, or testimonial copy.

Use actual customer names, logos, quotations, and portraits only with permission. Do not generate testimonial content or imply that a model is a customer.

### 22. About and mission photography

**Location:** Future About/team/mission page.\
**Purpose:** Show the actual people behind the platform and its service-business focus.\
**Format:** Real team photo, 2400×1600 landscape and 1600×2000 portrait crops.\
**Prompt:** Do not generate a substitute team portrait. Commission or capture the actual team in a real workspace using this art direction: candid working interaction, practical field-service detail, natural window light, warm skin tones, restrained navy/teal grade, generous environmental context, no staged boardroom pose. If the team cannot be photographed, use the hero’s abstract visual language rather than synthetic people presented as the company team.

### 23. Pricing section visual

**Location:** Future pricing page or plans section.\
**Purpose:** Support the $300–$2,000/location pricing story without distracting from tier comparison.\
**Format:** 1600×1000 WebP; right-side illustration with negative space for real pricing cards.\
**Prompt:**

> Create an understated precision 3D composition of three stacked service-capacity modules increasing in scale, representing a small-to-growing HVAC location. Use graphite bases, porcelain surfaces, teal capacity lines, cobalt details, and tiny warm amber service markers. Isometric view, soft studio light, clean enterprise finish, generous whitespace, no currency, numbers, words, fake charts, trophy, or rocket ship.

### 24. Final CTA visual

**Location:** Future homepage, immediately above footer.\
**Purpose:** Close with confidence and a sense of operational readiness.\
**Format:** 2200×900 WebP; wide 2.44:1.\
**Prompt:**

> Create a wide cinematic abstract scene of a calm, precisely organized service workflow route crossing a deep navy field toward a warm-lit residential service location at the far right. Use a thin teal line, a few porcelain and graphite service nodes, soft cobalt atmospheric depth, one restrained amber light source, elegant negative space across the left half for a CTA. Premium enterprise software campaign, physically plausible materials, no text, logos, glowing particles, or sci-fi landscape.

### 25. Resource/blog cover family

**Location:** Future blog and resource listing/detail pages.\
**Purpose:** Make editorial content recognizable while preserving a consistent grid.\
**Format:** Four 1600×900 covers, WebP/AVIF, with crops safe for 1:1 cards.\
**Prompt template:**

> Create a premium editorial cover image for an HVAC operations article about **[TOPIC]**. Use one clear physical subject, authentic residential-service context, cinematic but believable photography, restrained navy and teal grade with a small warm amber practical light, high detail, composed for a 16:9 crop with open space for a separately typeset title. No words, logos, fake UI, or stock-photo clichés.

Topics: answering missed calls; setting quote approval policies; managing service history; preparing technicians for a booked visit.

### 26. Open Graph and social-share image

**Location:** Homepage metadata, campaign shares, demo links.\
**Purpose:** Make shared links legible and recognizable in social previews.\
**Format:** 1200×630 PNG/WebP master; keep text and mark in the center-safe area.\
**Prompt:**

> Create a premium social-share background for AI Employee OS: deep carbon-navy field, a subtle teal route connecting a phone, booked visit, quote, and human handoff as clean sculptural glyphs on the right half; broad uninterrupted dark space on the left for a separately typeset headline and approved logo. Crisp silhouette at small preview size, polished studio lighting, high contrast, no text, no logos, no small details.

### 27. Footer and section divider motif

**Location:** Future marketing footer and dividers between major landing-page sections.\
**Purpose:** Carry a quiet visual signature through the site without adding decoration to every panel.\
**Format:** 2400×400 transparent WebP or SVG-redrawn route motif; also create a 1× repeating CSS background.\
**Prompt:**

> Create a minimal horizontal precision-line motif for an enterprise HVAC operations brand: one thin teal route with three small clean nodes, fading into porcelain-white or deep navy depending on variant. Very low contrast, wide and sparse, precise geometry, no glowing dots, no text, no ornamental curves, seamless continuation at both left and right edges.

## Asset handling and rollout

- Store source masters in `apps/web/public/brand/`, `marketing/`, `roles/`, `product/empty/`, and `resources/`. Export raster photography as AVIF/WebP with responsive derivatives.
- Keep diagrams, glyphs, logo, and dividers as SVG where possible. Give decorative images empty alt text; write descriptive alt text for meaningful HVAC photography.
- Keep real dashboard tables, metrics, transcripts, call waveforms, and approval states live and accessible in HTML/CSS/SVG.
- Start with the identity, role glyphs, real dashboard capture, and current empty/error states. Then build the marketing hero and feature visuals. Produce About photography, customer proof, and blog covers only when the corresponding pages and approved source material exist.
