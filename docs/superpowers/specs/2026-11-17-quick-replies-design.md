# Quick replies: text instead of images (Evaggelia first)

## Why
Guests send inquiries on WhatsApp, Viber, Instagram, etc. The team answers by
copying a ready reply from the Templates page. Today the replies are fixed PNG
images per hotel with dates drawn on top. The images carry a stale seasonal
price list, can't be auto-translated, and the guest can't copy the IBAN.
Elegancia currently sends two of Evaggelia's images by mistake.

## What we build
The four template cases become **plain-text replies** with an
**Ελληνικά / English** switch and one **Copy** button. No images.

| Case (template name) | Inputs | Output adds |
|---|---|---|
| `availability_confirmation` | check-in, check-out, number of apartments | dates, price block, amenities (in template text) |
| `alternative_dates` | up to 3 periods, number of apartments | each period with its own price block |
| `booking_confirmation` | check-in, check-out, **apartment tabs (multi-select)**, advance amount, payment method | dates, booked apartment names, price block, payment details as copyable text |
| `no_availability` | nothing | text only |

### Price block rules (all priced cases)
- Nightly price comes from the price list's **Απευθείας** column (`PriceRange.pricePerNight`).
- A stay can cross several price ranges: consecutive nights with the same price form one line,
  e.g. `10 – 15 July: 5 nights × 80€ = 400€`.
- Every night's price can be **changed manually** in the composer, whether or not it exists in the price list.
  Changes apply to that reply only; the price list is never written.
- A night with no price in the list is flagged and must be typed before Copy is enabled.
- Total = per-apartment total × number of apartments. The "per apartment / N apartments ×" lines
  appear only when N > 1.

### Message formatting
Plain text that reads well in any chat app: no emojis, no `*bold*` markers (they show as
literal asterisks outside WhatsApp), UPPERCASE section headings, blank lines between sections.
Greek number format (`1.750€`), dates as `10 July 2026` / `10 Ιουλίου 2026`.

### Template text
Each template row gets Greek fields next to the English ones. The text holds placeholders the
composer fills: `{{DATES}}`, `{{PRICE}}`, `{{ALTERNATIVE_DATES}}`, `{{APARTMENTS}}`,
`{{PAYMENT_INFO}}`. Amenities are plain text in the template, so each hotel edits its own.
All four cases get an "edit template" mode with EN/GR tabs.

## Decisions taken by the builder (user can override)
- All apartments of a hotel share one price list (the price list screen copies every range to
  all apartments), so prices are read from the hotel's first apartment.
- Schema: two **nullable** columns on `EmailTemplate` (`subjectEl`, `bodyEl`). Additive only,
  applied with `prisma db push` per the project's schema approach.
- Evaggelia's four texts (EN + GR) are written by a one-off script, run on dev first; on
  production only after a backup and the user's go-ahead.
- Old image code, `public/email-templates/`, and the price-list image UI are removed from the
  composer. The `imageUrl` / `includeImageByDefault` columns stay (no destructive schema change).

## Out of scope
Elegancia texts (next, same mechanism), images/cards, SaaS/auth.
