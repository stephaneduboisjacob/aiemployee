# Installed image asset kit

The supplied `AI-Employee-OS-Image-Asset-Kit.zip` is installed under `apps/web/public/`. Next.js serves each file at the same path below `/`, so the dashboard and future product routes can use the set without a remote image provider.

## Active product placements

| Placement | Installed assets |
| --- | --- |
| Dashboard overview hero | Responsive HVAC photography: `/marketing/landing-hero-desktop.webp` and `/marketing/landing-hero-mobile.webp` |
| Public landing page | `apps/web/public/index.html` and `landing.css`; uses responsive hero photography, workflow art, five employee glyphs, channel and memory art, audit/approval artwork, HVAC editorial photography, and final CTA scene |
| Sidebar identity | `/brand/ai-employee-os-mark.svg`; the matching favicon and light app icons are registered in page metadata |
| Channel navigation | `/product/channels/phone.png`, `email.png`, and `calendar.png` |
| Digital employee cards | Five role glyphs in `/product/roles/`, rendered in dark tiles so the transparent illustrations stay legible |
| Workflow empty state | `/product/empty/overview-workflow-idle.webp` |
| Task and approval empty states | `/product/empty/task-inbox.webp` |
| Customer empty state | `/product/empty/customer-list.webp` |
| Schedule empty state | `/product/empty/schedule.webp` |
| Audit empty state | `/product/empty/audit-history-verified.webp` |
| Application route error | `/product/errors/not-found.webp` and `/product/errors/workflow-retry.webp` |
| Footer | `/marketing/footer-route-motif.webp`, used as a restrained decorative texture |
| Social sharing | `/marketing/open-graph.webp` registered for Open Graph and Twitter cards |

The overview hero crops to the supplied mobile composition below 540 px. Other illustrations sit on a dark navy field sampled from the artwork palette; this keeps the pale, transparent 3D objects visible against the otherwise light dashboard.

## Installed library

All usable kit files were copied, retaining their original directories and names. The public library includes:

- **Brand (14):** three editable marks, two wordmarks, favicon, and eight 48–512 px light/dark app icons.
- **Marketing (14):** desktop/mobile landing hero, Open Graph card, orchestration, shared memory, unified channels, trust, capacity pricing, final CTA, testimonial backdrop, footer route, and three HVAC editorial photographs.
- **Product (21):** five employee role glyphs, four channel glyphs, five empty states (including the overview workflow), four error illustrations, live call supervisor, integrations onboarding, and global texture.
- **Resources (4):** missed calls, service history, booked visits, and quote approval article covers.

Dimensions are preserved from the kit: hero photography is 2560×1600 and 1600×2000; social art is 1200×630; editorial and resource photography is 2400×1600 and 1600×900; product glyphs are 512×512; empty/error illustrations are 720×480 (overview workflow 800×560). SVG marks remain resolution independent.

## Source and limitations

These assets are generated concept artwork, not screenshots of actual product screens. The image kit intentionally contains no fabricated customer logos, testimonials, or team portraits. Those require approved customer evidence and real team photographs before they can be published as social proof.

`product/dashboard-device-mockup.webp` in the supplied archive was zero bytes. It was omitted because it cannot render. The other 53 non-empty files were installed. Marketing feature images, resource covers, and the supervisor/onboarding scenes are available in the library for their corresponding sections as those surfaces are added.

The public landing page is published to the existing Nginx web root by `scripts/publish-static-landing.sh`. It uses external CSS and same-origin assets to comply with the current Content Security Policy. The public API remains health-only; the seeded interactive workspace runs through local Compose until production app services are configured.

---

Contact: Stephane Jacob <jacobstephane@outlook.com>
