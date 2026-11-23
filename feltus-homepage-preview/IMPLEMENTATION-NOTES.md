# FELTUS LABS / Homepage — controlled integration notes

**Status:** Visual HTML/CSS preview, NOT integrated into ZEVO-audit repository or deployed to feltuslabs.com.

## Approved visual
- Desktop artwork source: `complexity_into_clarity.png` from current ChatGPT conversation.
- The source image is cropped to isolate the hero illustration. The webpage text, CTAs and navigation are real HTML, not screenshot-based.
- `assets/logo-preview.png` is a **temporary crop for visual review only**. Use the exact original master FELTUS LABS logo from the website project for production; do not ship the crop as the authoritative logo.

## Protect existing functionality
- Only replace markup and CSS owned by the actual homepage route. Preserve the current project's routes, IDs, links, event handlers, forms, booking, Stripe checkout, APIs, scripts and shared site components.
- The sample links use `data-bind-route`. Their fragment targets are **not verified routes**. Bind each link to its existing route before going live. Do not introduce duplicate navigation or replace real handlers.
- The standalone mobile menu is presentation-only. Prefer the current site's navigation handler where one exists.
- Keep `#feltus-homepage` CSS scope to avoid affecting ZEVO/research or other pages.
- Do not append new page-wide CSS override chains; remove only obsolete homepage-specific CSS after examining usages.

## Pre-integration blocker
- Connected GitHub repository `livinglegendstour-stack/ZEVO-audit` shows branch `main` with a 2,207,171-byte single `index.html`. Its contents could not be returned through the connected GitHub file reader, so the existing routing, CSS, scripts and logo paths remain unverified. Avoid overwriting this file. To safely integrate, provide the current index.html as a file or a ZIP of the current folder, or otherwise make inspectable source available.

## Validation plan
1. Inspect current live page markup and working feature bindings before changing code.
2. Reuse real logo and original clean art source if available.
3. Match homepage at desktop 1366x768, 1440x900, 1536x864, 1920x1080 and mobile 360,375,390,414,430.
4. Verify all real route links, project inquiry, consultation selection and Stripe-related flows remain unchanged.
5. Verify all non-home routes and any ZEVO research pages are unaffected.
6. Review Git diff; do not commit, push or deploy until explicitly approved.
