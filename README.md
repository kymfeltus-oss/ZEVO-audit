# FELTUS LABS — Neon Brand Website

This is the **brand-aligned redesign** of the existing FELTUS LABS professional-services website. It uses the color and artwork direction of the supplied FELTUS LABS neon dashboard reference, while retaining the public-facing business-services content (rather than reproducing the product dashboard).

## Open locally

1. Unzip the project folder.
2. Keep `index.html` and the `assets` folder together.
3. Open `index.html` in Chrome or Edge. No build commands, Node installation, database, or API keys are needed.

## Included navigation

- **Home:** Corporate entrance and all six clickable service divisions
- **Accounting & Financial Operations:** Setup, cleanup, recurring bookkeeping, controller support, sample starting price ranges, FAQs
- **Corporate Reviews & Forensic Analysis:** Research, documentation and investigation support, ZEVO research placeholder
- **Data Intelligence & Reconciliation:** Merging, matching, reconciliation and process automation
- **Mergers & Acquisitions Support:** Due diligence, acquisition accounting and financial integration
- **Debt Covenant & Lender Reporting:** Monitoring, reporting and scenario support
- **Financial Systems & Integration:** ERP, conversions, financial system automation
- **Technology:** FELTUS technology direction, distinguished from current services
- **Our Approach:** Consulting perspective and workflow
- **Contact:** Service-specific inquiry form

## Project structure

```text
FELTUS_LABS_Neon_Brand_Website/
├── index.html
├── assets/
│   ├── css/
│   │   ├── styles.css     # Original responsive layout / component CSS
│   │   └── brand.css      # Brand alignment / neon visual theme
│   ├── js/
│   │   └── app.js         # Service data, routing, forms and menus
│   └── images/
│       ├── feltus-brand-mark.png
│       └── feltus-hero-art.webp
└── README.md
```

The two visual image assets were cropped from the brand reference supplied for this redesign. The same visual identity is carried through the entire site.

## Before publishing

- **Inquiry form is a safe preview, not a live submission system.** It prepares a copyable inquiry summary. It does not email, transmit or store form information. Connect a secure delivery service, then test it end-to-end before accepting client inquiries.
- **ZEVO:** The existing ZEVO corporate research website and exhibits have not been modified. Add its verified live URL if you want public visitors to open it. No findings or allegations are published in this mockup.
- **Prices:** Accounting package prices are illustrative initial ranges, not guaranteed quotes. Review them before posting.
- **Professional services:** Check all necessary licensure, service-scope and advertising requirements before publishing descriptions of regulated financial services. The site does not advertise statutory attestation/audit opinions.
- **Technology:** Technology initiatives are described as direction; do not represent unavailable product features as currently for sale.
- **Fonts:** Google Fonts is optional. System fallback fonts will render if the browser is offline.

## Publish

Upload all project files, preserving the folder structure, to a static hosting provider. `index.html` is the entry point. Hash routes (`#/accounting`, `#/data-intelligence`, etc.) work without server-side route configuration.

This deliverable does **not** modify the live FELTUS LABS site or any production application.
