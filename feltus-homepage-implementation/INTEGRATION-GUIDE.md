# FELTUS LABS — Homepage Design Implementation

## Scope and approval

**Target:** `feltuslabs.com` / `kymfeltus-oss/ZEVO-audit` — homepage scroll only, with shared header/footer styling.

Approved source visuals, in scroll order:
1. Complexity Into Clarity(1).png — homepage hero
2. FELTUS LABS Service Divisions(1).png — service divisions
3. Beyond Numbers and Software(1).png — the approach
4. Neon Path to Clarity(1).png — process + conversation band
5. Feltus Labs Neon Header and Footer(1).png — site-wide navigation/footer

This ZIP is a **coded standalone preview and integration reference**, not a production overwrite. All sections are real HTML with scoped CSS and separate artwork. The `#contact` form is deliberately **non-submitting** and produces copyable text: it is *not* the production site's request handler.

## Critical safety rules

- **Do not copy this `index.html` over the existing repository `index.html`.** The live site has other important pages and application behavior.
- Inspect existing `index.html`, `zevo.html`, `assets/css/brand.css`, `assets/css/styles.css`, `assets/js/app.js`, and any booking/checkout code first.
- Preserve all existing routes, navigation destinations, project inquiry behavior, booking/Stripe checkout, ZEVO research, data, IDs, validation, and scripts. Keep the original working contact form with all fields and handlers; apply the new form styling to that original markup rather than substituting the demo form.
- **Official logo requirement:** `assets/logo-preview.png` is a cropped PREVIEW asset, not a verified master logo. Replace it with the exact approved master logo already in the repository; do not generate a new logo.
- `assets/hero-art.png` is a standalone *artwork-only* cropped element from the approved artwork, not the screenshot as the webpage background. Use an approved clean hero graphic if available in the repository.
- Fonts: Oxanium (headings), Manrope (nav/labels/buttons), DM Sans (body). Colors: #030512, #080C21, #B12DFF, #6B1CC8, #13D4FF, #EE34FF, #F6F8FF, #A7AEC7.
- This standalone review includes a shared header/footer once; each scroll section must NOT duplicate them.
- Use existing project actual route destinations in place of the demo section anchors and `data-existing-route` placeholders. Research & reviews must open the existing research/ZEVO route; don't create an empty #research target.

## Integration pattern (for Copilot or developer)

1. Begin from the **current project**, not an old ZIP. `git status` and identify local untracked work before starting. Work on a new branch, do not touch production.
2. Inspect the existing real homepage markup and page styles, then identify shared shell/header/footer and form/scripts. Record current behavior.
3. Treat `index.html` in this ZIP as **reference markup**. Transfer only the relevant hero, services, approach, process, conversation band, and cosmetic contact styles to the actual homepage containers.
4. Keep the site's existing header, footer, navigation, routes, event handlers, and inquiry form, changing only their visual markup/classes as required; keep links/handlers working.
5. Use `homepage.css` as the **design reference** and consolidate only the homepage rules into one current-project page-scoped stylesheet (scope to `#home` or the real homepage root). Shared header/footer tokens may be applied to existing site shell components once with regression checks.
6. Don't import `homepage.js` into production if it would replace existing behavior. It only provides preview mobile menu and copy-inquiry functionality.
7. Verify 360,375,390,414,430px mobile and 1366×768,1440×900,1536×864,1920×1080 desktop; check overflow, clipping, and readable touch targets.
8. Visit every existing page, service route, research/ZEVO link, consultation and payment path. Confirm the other pages are intact.
9. Report `git status`, `git diff --stat`, files changed, tests actually run, remaining issues. **No commit/push/deploy until visual approval.**

## Suggested Copilot directive

> Read `feltus-homepage-implementation/INTEGRATION-GUIDE.md` and inspect the existing current `index.html`, shared CSS/JS, route mapping, and form logic. Use the five approved screenshots and `feltus-homepage-implementation/index.html` + `homepage.css` as the visual target for ONE continuous homepage. The approved screenshot controls appearance; the existing application controls functionality. Implement these scroll sections and consistent shared header/footer visuals only; preserve every existing real navigation route, booking/Stripe checkout, form, events, content and ZEVO research page. Do not overwrite the root index.html with the preview; do not use screenshots as page backgrounds; use the original approved logo asset. Scope CSS to home, avoid global leakage. Validate all target viewports and other routes. Report files/diff/status. Do not commit, push, merge, or deploy.

## File map

- `index.html`: full standalone preview
- `homepage.css`: responsive CSS, scoped under `#feltus-homepage`
- `homepage.js`: preview-only mobile menu, service selector, copyable inquiry
- `assets/hero-art.png`: artwork-only source layer from previously approved mockup
- `assets/logo-preview.png`: placeholder only; MUST replace with original approved logo in production
- `references/*.png`: the five supplied approved images (for developer inspection, *not* deployment assets)
