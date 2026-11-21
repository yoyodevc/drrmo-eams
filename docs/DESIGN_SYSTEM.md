# Design System

How every screen in DRRMO EAMS should look and feel. Read this before any UI work. The tokens live in `resources/css/app.css` and the shared pieces live in `resources/js/shared/ui`. The login screen (`resources/js/pages/Login.tsx`) is the reference build.

## 0. The prompt

Paste this at the start of any UI task, for a person or for an AI helper.

```
You are designing a screen for DRRMO EAMS, the Personnel Event Assignment and
Monitoring System of the ZPPSU Disaster Risk Reduction and Management Office.
Follow docs/DESIGN_SYSTEM.md exactly.

Look and feel: calm, official and trustworthy, like a well run university office.
Not playful, not flashy. Plenty of white space, one clear main action per screen.
Keep decoration quiet. Allowed: one soft maroon gradient on a large brand
surface, the ZPPSU gear as a faint watermark, a thin gold rule, and the short
gold to orange brand stripe above a main heading. Not allowed: dot or grid
patterns, glass effects, neon glows, pill badges, emoji, or filled icon tiles.

Colors: ZPPSU maroon is the brand and the color of primary buttons. Gold is a
small accent on dark maroon surfaces only. DRRMO orange ("ember") means live or
urgent: on duty, overdue, live map. Neutrals are Tailwind "stone". Never invent
new hex values; use the tokens.

Type: Public Sans. Body 16 px. Headings bold with tight tracking.

Shapes: rounded-control (8 px) for buttons and inputs, rounded-card (12 px) for
cards, rounded-sheet (16 px) for bottom sheets. Borders before shadows; shadows
only on things that float, like menus and dialogs.

Layout: Marshal, Volunteer and Coordinator screens are mobile first at 360 to
430 px, one column, tap targets at least 48 px, main action at thumb reach.
Admin screens are desktop first at 1280 px, sidebar plus wide content.

Reuse Button, TextField, PasswordField, Alert, BrandLogos and Spinner from
resources/js/shared/ui before writing new markup. Every screen needs loading,
empty, error and offline states. Write copy in short, plain sentences.
```

## 1. The idea

The system belongs to two owners, and the design shows both.

- **ZPPSU** gives the base: deep maroon and gold. It makes the app feel official and part of the university.
- **DRRMO** gives the signal: a bright orange we call **ember**. It is used sparingly, only where something is live or needs attention now.

### Restraint

The design should look like it was made by an office that takes safety seriously, not like a startup landing page. In practice:

- Brand surfaces (only the login brand panel today) may use one soft gradient from `maroon-800` to `maroon-950`, with a faint gold light in one corner. Everything else is solid.
- The ZPPSU gear may sit behind a brand surface as a watermark at 5% opacity, grayscale, desktop only.
- The **brand stripe** is a short bar (4 by 48 px) from gold to DRRMO orange. It joins the two offices. Use it once per screen at most, above the main heading. It is for admin, sign in and notice screens. Phone tab screens (Duties, Reports, Messages, Memos, Me, Alerts) leave it out and open with the title, so they stay quiet.
- Eyebrow labels on maroon use a thin gold rule and uppercase gold text, never a pill or badge.
- Lists of points use outline icons in a hairline square, separated by hairlines. No filled tiles.
- Hierarchy comes from size, weight and spacing, not from boxes, badges and colors.
- Every screen should still make sense in grayscale.

## 2. Logos

Files are in `public/images/brand/`.

| File | Use |
|---|---|
| `zppsu-logo.webp` | Screens (transparent background) |
| `drrmo-logo.webp` | Screens (white background removed) |
| `zppsu-logo.png`, `drrmo-logo.png` | Printouts, where WebP may not work |
| `email/zppsu-logo.png`, `email/drrmo-logo.png` | Emails. 96 px tall (shown at 48 px), about 20 KB each, sent inside the message |
| `apple-touch-icon.png`, `icon-192.png`, `/favicon.ico` | Browser tab and phone home screen |

Rules:

- Use the `BrandLogos` component when both logos appear. ZPPSU always comes first (left), because DRRMO is an office under the university.
- Show both logos on the login screen, the privacy notice and printed reports. Inside the app, the top bar may show only the small pair at `size="sm"`.
- Do not stretch, recolor, crop or add outlines. A soft drop shadow on dark backgrounds is fine.
- Smallest size is 36 px. Below that the text inside the seals cannot be read.
- Always keep the alt text. It names the university and the office.

## 3. Color

Use Tailwind classes with these names, for example `bg-maroon-700` or `text-ember-700`.

### Brand

| Token | Hex | Use |
|---|---|---|
| `maroon-50` | `#fbf3f3` | Selected row, hover on ghost buttons |
| `maroon-100` | `#f6e3e4` | Active nav item background |
| `maroon-600` | `#962a30` | Focus outline, links on hover |
| `maroon-700` | `#7d1d23` | **Primary buttons, links, active icons** |
| `maroon-800` | `#661419` | Hover on primary, browser theme color |
| `maroon-900` | `#520f14` | Dark surfaces: login brand panel, admin sidebar |
| `maroon-950` | `#33080b` | Deepest end of gradients |
| `gold-200` to `gold-300` | `#fbe08e` to `#f7cb4f` | Accent text and icons on dark maroon |
| `gold-400` | `#f2b82a` | Thin rules on maroon, start of the brand stripe |
| `ember-500` | `#f04e12` | End of the brand stripe, live dots, map pins (not for text) |
| `ember-600` | `#d63a0a` | "On duty" button and banner background (white text passes AA) |
| `ember-700` | `#b12c0b` | Ember text on white (overdue, late) |

Full scales from 50 to 950 are in `app.css`.

### Neutrals

Tailwind `stone`, which is slightly warm and sits well next to maroon.

| Token | Use |
|---|---|
| `stone-50` | Page background on app screens |
| `white` | Cards, forms, the login form side |
| `stone-200` | Card borders and dividers |
| `stone-300` | Input borders |
| `stone-500` | Hints and timestamps (smallest allowed gray for text) |
| `stone-600` | Secondary text |
| `stone-900` | Main text |

### Status

| Meaning | Chip classes | Example |
|---|---|---|
| Assigned, waiting | `bg-sky-50 text-sky-800 ring-sky-200` | Assigned |
| Acknowledged, done, on time | `bg-green-50 text-green-800 ring-green-200` | Acknowledged, Submitted |
| On duty, live | `bg-ember-50 text-ember-700 ring-ember-200` plus a pulsing `bg-ember-500` dot | On duty |
| Needs attention soon | `bg-amber-50 text-amber-900 ring-amber-200` | Due in 15 min, Late |
| Problem | `bg-red-50 text-red-800 ring-red-200` | Overdue, Failed, No ping 5+ min |
| Ended, cancelled, inactive | `bg-stone-100 text-stone-600 ring-stone-200` | Ended, Cancelled |

Rules:

- Color is never the only signal. A chip always has a word, and an alert always has an icon.
- Text must pass WCAG AA (4.5 to 1). Gold never goes on white as text. Ember text on white uses `ember-700`.
- Destructive actions (delete, revoke, cancel event) use `red`, not ember. Ember means "live", red means "danger".

## 4. Type

- Font: **Public Sans** (variable, self hosted through `@fontsource-variable/public-sans`, so it works offline and sends no data to Google). It was made for government services and reads well outdoors.
- Body text is 16 px (`text-base`) everywhere. On phones, inputs must stay at 16 px or iOS zooms in.

| Role | Classes |
|---|---|
| Display (login brand panel only) | `text-[1.625rem] sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-balance` |
| Page title | `text-2xl font-semibold tracking-tight text-stone-900` |
| Section title | `text-lg font-semibold text-stone-900` |
| Body | `text-base text-stone-700` |
| Secondary | `text-sm text-stone-600` |
| Label | `text-sm font-medium text-stone-800` |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.14em]` |
| Numbers in tables | add `tabular-nums` |

Use `text-pretty` on paragraphs so the last line is not a single word.

## 5. Shape, space and depth

- Spacing follows Tailwind's 4 px steps. Common gaps: 8 px inside a control, 16 px between fields, 24 to 32 px between sections.
- Page padding: 24 px on phones (`px-6`), 40 px on tablets (`sm:px-10`), 56 px or more on desktop.
- Radius tokens: `rounded-control` (8 px) for buttons, inputs and alerts; `rounded-card` (12 px) for cards and panels; `rounded-sheet` (16 px) for bottom sheets. Chips and avatars use `rounded-full`.
- Shadows: none on inputs, buttons or cards. `shadow-raised` only on things that float above the page: menus, dialogs and sheets.
- Prefer a 1 px `ring-stone-200` or `border-stone-200` over a shadow for flat cards on white.

## 6. Components

All in `resources/js/shared/ui`. Add a new shared piece only when two screens need it.

**Button** (`Button.tsx`)
- Variants: `primary` (maroon, one per screen), `secondary` (white with border), `ghost` (text only), `danger` (red), `duty` (ember, only for Start duty, End duty and live actions).
- Sizes: `lg` is 48 px tall and is the default on phones. `md` is 40 px for dense admin toolbars.
- `loading` shows a spinner and disables the button, so nobody submits twice. Change the label too, for example "Signing in...".
- Use `block` for full width buttons on phones.

**TextField and PasswordField**
- The label is always visible above the input. Placeholders are only for examples, never instead of a label.
- Error text goes under the field in `text-red-700`, and the input gets a red border and `aria-invalid`.
- PasswordField has a show and hide button, because typing on a phone in the sun is hard.

**Alert**
- Tones: `error`, `warning`, `success`, `info`. Errors use `role="alert"` so screen readers read them right away.
- Place it right above the button that caused it.

**Confirm dialog** (`ConfirmDialog.tsx`)
- Use it before an action that is hard to undo or easy to hit by mistake, such as signing out. Do not use it for routine saves.
- A native `<dialog>` with `role="alertdialog"`. Centered at 640 px and up (`max-w-sm`, `rounded-card`, `shadow-raised`). A full width bottom sheet under 640 px (`rounded-t-sheet`, bottom padding respects the safe area).
- Title is a short question ("Sign out?"). The body says what happens next in one sentence.
- The confirm button is `primary` unless the action destroys data, then it is `danger`. Cancel is `secondary` and gets focus first.
- Desktop buttons sit right aligned, Cancel then confirm, at `md`. On phones they stack full width at `lg`, confirm on top.
- Esc and a click on the backdrop cancel. While the action runs, the confirm button shows a spinner and a new label ("Signing out..."), and Cancel, Esc and the backdrop do nothing.
- If the action fails, keep the dialog open and show an `Alert` with `tone="error"` above the buttons.
- A dialog may hold one short field under the body, such as a reason. The confirm button stays disabled until the field is valid.
- Closing returns focus to the button that opened it.

**Notice banner** (`CookieBanner.tsx`)
- For a one time notice that needs no choice, such as the cookie notice. It never blocks the page: no backdrop, no focus trap, and it does not take focus when it appears.
- Phones: a white bar fixed to the bottom, full width, `border-t border-stone-200 shadow-raised`, bottom padding respects the safe area. Add a spacer at the end of the page so it never hides the last link.
- 640 px and up: a floating card at the bottom right (`max-w-md rounded-card ring-1 ring-stone-200 shadow-raised p-5`), so it sits over the white side and never covers the maroon panel.
- A short title, one or two sentences, a text link on the left and one `primary` button on the right ("Got it").
- Remember the dismissal in local storage, not a cookie. After dismissal, move focus to `main`.

**Cards**
- `rounded-card bg-white ring-1 ring-stone-200 p-4` on phones, `p-6` on desktop.
- On phones, the whole card is the tap target when it opens a detail screen.

**Chips** (status)
- `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset` plus the status classes in section 3.

**Icons**
- Line icons, 24 px grid, 1.8 stroke, round caps and joins, `currentColor`. Draw them as inline SVG like the ones in Login.tsx. Do not add an icon font.
- Decorative icons get `aria-hidden="true"`. Icon only buttons need an `aria-label`.

## 7. Layouts

### Phone screens (Marshal, Volunteer, Coordinator)

```
+-----------------------------+
| [logos sm] DRRMO    [bell]  |  white top bar, 1 px stone-200 bottom border
| [On duty banner, ember-600] |  only while on duty
|                             |
|  Page title                 |
|  One main card or form      |  stone-50 background, white cards
|  Short list                 |
|                             |
|  [ Main action, 48 px ]     |  sticky above the tab bar when it matters
+-----------------------------+
| Duties | Memos | Msgs | Me  |  white tab bar, active tab maroon with a pill
+-----------------------------+
```

- Design at 360 px first, then check 375 and 430. No sideways scroll.
- Tap targets at least 48 by 48 px, with 8 px between them.
- Keep the main action in the lower half of the screen, where thumbs reach.
- Respect the iPhone safe area with `pb-[env(safe-area-inset-bottom)]`.
- From 768 px the tabs move into the top bar (icon and label, maroon underline on the active tab) and the bottom bar hides. Content sits in a centered column up to 1152 px (`max-w-6xl`), and card lists use two columns from 1024 px.

### Admin screens (desktop first)

```
+--------------+------------------------------------------------+
| [logos] DRRMO|  Page title                  [search] [user]   |  white top bar
|              +------------------------------------------------+
| Dashboard    |                                                |
| Events       |  stone-50 background                           |
| People       |  white cards and tables, max width 1440 px     |
| Map          |                                                |
| ...          |                                                |
+--------------+------------------------------------------------+
  maroon-900 sidebar, white text at 80%, active item white
  with a gold-400 bar on its left edge
```

- Design at 1280 px. Content area uses a 12 column grid with 24 px gaps.
- Tables: header `text-xs font-semibold uppercase tracking-wide text-stone-500`, rows 48 px tall, zebra striping off, hover `bg-stone-50`, numbers right aligned with `tabular-nums`.
- Filters sit above the table in one row. The primary action (for example "New event") sits at the top right of the page header.
- Below 1024 px the sidebar collapses to icons, and below 768 px it becomes a top menu (SCREENS.md).

### Login (reference build)

- Phone: a maroon header with both logos, the office names, the "DRRMO EAMS" eyebrow and the system name. A white sheet with rounded top corners slides over it and holds the brand stripe, the "Sign in" title, the form, and a privacy line under a hairline.
- Desktop: two columns. The left brand panel has the logos and office names at the top, then the eyebrow, system name, one sentence and three points separated by hairlines, with the gear watermark behind. The right side has the form on plain white.

### Emails

Every email uses one shared layout: `app/Modules/Notifications/Views/email.blade.php`. Build the content with `EmailMessage` (Notifications contract). Never write email HTML by hand in another module.

- Width 600 px, centered on a `stone-100` page. On phones (under 620 px) it goes full width with 24 px side padding.
- Header: a `maroon-900` bar with the soft maroon gradient, both logos (ZPPSU first) at 48 px, a gold "DRRMO EAMS" eyebrow and the office name in white.
- Card: white, `stone-200` border, 12 px bottom corners. The brand stripe sits above the heading. Heading 24 px bold `stone-900`, body 16 px `stone-700`.
- Blocks: `line` (a paragraph), `code` (a one time code in large type in a `stone-50` box), `button` (maroon, full width at every size, 8 px corners, with the link printed under it for copying), `details` (label and value rows split by hairlines), `notice` (a boxed note with an eyebrow label, such as a reason).
- One button per email at most. Sign off as "ZPPSU DRRMO". The footer names the office and says replies are not read.
- Tables and inline styles only, so it holds up in Gmail, Outlook and phone mail apps.
- Gmail drops a whole `<style>` block if one rule is unsupported. Keep layout rules, dark mode rules and Outlook (`[data-ogsc]`) rules in separate blocks, and never let the layout depend on a media query.
- Gmail on iPhone inverts text colors in dark mode. White text on maroon (button, header) sits inside the `gm-screen` and `gm-diff` blend layers, and the maroon also goes in a `background-image`, so both stay right. Dark mode mail apps get darker card colors through a media query. The header stays maroon in both.
- Every email also has a plain text part with the same words. The `preheader` is the short line inboxes show after the subject.
- Times are shown in Asia/Manila.
- Local preview: with `MAIL_MAILER=log`, the last email is saved to `storage/logs/mail-preview.html`.

## 8. States every screen needs

- **Loading:** gray skeleton blocks (`animate-pulse bg-stone-200 rounded`) in the shape of the real content. Never a blank page or a lone spinner in the middle.
- **Empty:** a small line icon, one sentence and, when it helps, the next step. Example: "No duties yet. DRRMO will email you when you are assigned."
- **Error:** an `Alert` with a plain message and a Retry button.
- **Offline (phones):** a thin `bg-stone-800 text-white text-sm` bar at the top: "You're offline. Changes will be sent when you reconnect."

## 9. Motion

- Short and quiet: 150 ms for hovers and color changes, 200 to 250 ms for sheets and dialogs, ease out.
- Only one thing pulses: the live dot next to "On duty".
- `prefers-reduced-motion` turns animation off. This is already handled in `app.css`.

## 10. Accessibility

- Every input has a label, every image has alt text, every icon only button has an `aria-label`.
- Focus is always visible: a 2 px maroon outline on light surfaces, gold on dark surfaces (add the `on-dark` class to a dark section).
- One `h1` per screen. Headings go in order.
- Check the screen at 200% zoom and with a keyboard only.

## 11. Writing

- Short, plain sentences. Talk to the person as "you".
- Buttons say what happens: "Sign in", "Start duty", "Send report". Not "Submit" or "OK".
- Error messages say what went wrong and what to do next.
- Use real looking but made-up data in screenshots. Emails end in `@example.test`.
- No em dashes.

## 12. Before you open a UI pull request

- [ ] Used tokens and shared components, no new hex values.
- [ ] Checked phone screens at 360 px, admin screens at 1280 px.
- [ ] Loading, empty, error and offline states are done.
- [ ] Keyboard and screen reader basics pass (labels, focus, alt text).
- [ ] Screenshot saved to `docs/capstone/figures/` (see DOCUMENTATION_GUIDE.md).
