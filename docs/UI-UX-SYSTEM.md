# UI / UX System

> **Phase 0 deliverable.** The design system for the rebuilt Hynish ERP: a premium, modern, responsive SaaS ERP UI built with **React + Tailwind CSS + shadcn/ui + Lucide + Manrope**. The legacy *look* is **not** reproduced. Legacy *behaviors* are (see `LEGACY-COMPATIBILITY.md §50`).
>
> Every color, radius, shadow and gradient is a **semantic token** defined once in `apps/web/src/styles/tokens.css` and mapped into `tailwind.config.ts`. Components use `bg-card`, `text-muted-foreground`, `bg-gradient-sales`, and so on. **Hard-coded hex or HSL values inside components are forbidden**, and lint enforces it (ESLint + a Tailwind plugin rule against arbitrary color values).

---

## 1. Design principles

1. **Clarity over decoration.** Numbers are the product. Big, tabular and aligned.
2. **Speed of entry.** Billing is keyboard-first on desktop and thumb-first on mobile.
3. **One system.** Every surface draws on the same tokens, so theme changes need no component edits.
4. **Controlled premium.** Gradients only on designated metric and action cards, never on body surfaces or tables.
5. **Honest states.** Loading, empty, offline, error and "needs confirmation" states are designed, never blank.
6. **Accessible by default.** WCAG 2.2 AA.

## 2. Typography

| Token | Value |
|---|---|
| Font family | **Manrope** (variable, weights 400–800), self-hosted via `@fontsource-variable/manrope` so it works offline in the PWA shell. Fallback: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. |
| Numerals | `font-variant-numeric: tabular-nums` on all money, qty and table numeric cells (`.num` utility) |

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 36/40 (mobile 28/34) | 800 | KPI values on hero cards |
| `h1` | 28/34 (mobile 22/28) | 700 | Page titles |
| `h2` | 20/28 | 700 | Section / card titles |
| `h3` | 16/24 | 600 | Sub-sections |
| `body` | 14/22 (mobile 15/24) | 500 | Default text |
| `body-sm` | 13/20 | 500 | Table cells, secondary |
| `caption` | 12/16 | 600, +0.02em tracking, uppercase optional | Labels, badges |

Minimum on-screen text is 12 px. Inputs are at least 16 px on mobile to stop iOS zooming on focus.

## 3. Color

### 3.1 Semantic tokens

Stored as HSL channel triplets (`--primary: 234 83% 58%`) so Tailwind can apply opacity (`bg-primary/10`).

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | 220 33% 98% | 224 40% 7% | App canvas |
| `--foreground` | 224 40% 12% | 220 20% 94% | Default text |
| `--card` | 0 0% 100% | 224 34% 11% | Cards, panels |
| `--card-foreground` | 224 40% 12% | 220 20% 94% | |
| `--popover` | 0 0% 100% | 224 34% 13% | Menus, popovers, sheets |
| `--popover-foreground` | 224 40% 12% | 220 20% 94% | |
| `--primary` | 234 83% 58% | 234 90% 68% | Brand indigo: primary actions, focus |
| `--primary-foreground` | 0 0% 100% | 224 40% 8% | |
| `--secondary` | 220 25% 94% | 224 25% 18% | Secondary buttons, chips |
| `--secondary-foreground` | 224 40% 16% | 220 20% 92% | |
| `--muted` | 220 22% 95% | 224 25% 15% | Subtle fills, table stripes |
| `--muted-foreground` | 220 12% 42% | 220 12% 66% | Secondary text (≥ 4.5:1 on card) |
| `--accent` | 234 83% 96% | 234 40% 20% | Hover and selected rows |
| `--accent-foreground` | 234 70% 36% | 234 90% 86% | |
| `--border` | 220 18% 89% | 224 22% 20% | Hairlines |
| `--input` | 220 18% 86% | 224 22% 24% | Input borders |
| `--ring` | 234 83% 58% | 234 90% 68% | Focus ring |
| `--success` | 152 60% 36% | 152 55% 50% | Paid, healthy stock, profit |
| `--success-foreground` | 0 0% 100% | 152 60% 8% | |
| `--warning` | 36 92% 46% | 38 92% 58% | Due soon, low stock, partial |
| `--warning-foreground` | 36 90% 10% | 36 90% 8% | |
| `--danger` | 356 72% 50% | 356 80% 64% | Overdue, out of stock, loss, destructive |
| `--danger-foreground` | 0 0% 100% | 356 70% 8% | |
| `--info` | 206 88% 46% | 206 90% 62% | Informational, Without-GST badge |
| `--info-foreground` | 0 0% 100% | 206 80% 8% | |

shadcn's `--destructive` is aliased to `--danger`. Chart series tokens are `--chart-1 … --chart-6` (indigo, emerald, amber, rose, sky, violet), and each has a tuned dark variant.

**Status mapping (legacy badges)**

| Legacy status | Token |
|---|---|
| Paid / Healthy / Current / Balanced ✓ | success |
| Partial / Due Soon / Low stock / Has Balance | warning |
| Unpaid / Overdue / Out of stock / Over Limit / Loss | danger |
| No Due Date / Without GST / Pending DN / Open quote | info or secondary |
| Converted / Invoiced / Returned | secondary |

### 3.2 Light theme
Near-white canvas (`--background`), pure white cards with a hairline border and a soft shadow. The primary color is used sparingly, for actions and focus.

### 3.3 Dark theme
Deep navy canvas (continuing the legacy manifest palette `#0F1626`/`#172033`), elevated cards lighter than the canvas, borders and shadows replaced by lighter elevation, and saturated status colors lifted for contrast. Charts use the dark chart tokens.

### 3.4 Theme system: Light / Dark / System
- `ThemeProvider` (in `app/providers`) keeps `preference: 'light' | 'dark' | 'system'` and the `resolved` theme.
- Persistence: `localStorage['hynish:theme']` for the first paint on this device, **and** `users/{uid}.preferences.theme` so the choice follows the user across devices. The server value wins after sign-in.
- **No flash:** an inline script in `index.html` reads localStorage and sets `class="dark"` and `color-scheme` before React mounts.
- `system` follows `matchMedia('(prefers-color-scheme: dark)')` and updates live.
- `<meta name="theme-color">` is updated with the resolved theme (it tints the browser and PWA chrome).
- Tailwind `darkMode: 'class'`. Components never branch on the theme in JS. They only use tokens.
- The default preference for a new user is OQ-08 (recommended: `system`).

## 4. Spacing, radius, elevation

| Token | Value |
|---|---|
| Spacing scale | Tailwind 4-px scale. Page padding: mobile 16, tablet 24, desktop 32. Card padding: 16 / 20 / 24. Section gap: 24 (mobile 16). |
| `--radius` | 14 px (base). `rounded-lg` = radius, `rounded-md` = radius − 4, `rounded-sm` = radius − 8, `rounded-2xl` (20) for hero cards, `rounded-full` for chips and FABs. |
| Shadows | `--shadow-xs` hairline; `--shadow-sm` cards; `--shadow-md` popovers and hover lift; `--shadow-lg` dialogs and sheets; `--shadow-glow-{variant}` colored glow for gradient cards (light only). In dark mode, shadows reduce to a subtle 1-px highlight ring and elevation comes from surface lightness. |
| Motion | 150 ms (hover, press), 200 ms (popover), 280 ms (sheet, dialog), easing `cubic-bezier(.2,.8,.2,1)`. All motion is wrapped in `motion-safe:`, and `prefers-reduced-motion` disables it. |

## 5. Cards

| Component | Use |
|---|---|
| `Card` (shadcn) | Default container |
| `PageHeader` | Title, description, primary actions. On mobile, actions collapse into an overflow menu plus a sticky primary. |
| `MetricCard` | KPI: label, value (display type), delta chip, sparkline slot, icon |
| `GradientCard` | Premium KPI or quick-action card with a variant gradient (§6) |
| `ActionCard` | Quick actions (Dashboard's 6 quick actions, LC-38.1) |
| `ListCard` | Mobile row representation of a table record |
| `SectionCard` | Settings sections (Business Details, Numbering, Bank, …) |

## 6. Premium gradient cards (centralized)

Variants are defined **once** as CSS custom properties and exposed as Tailwind utilities (`bg-gradient-sales`, and so on) plus a `GradientCard variant="sales"` prop. Components never write their own gradient stops.

| Variant | Light (from → to) | Dark (from → to) | Used for |
|---|---|---|---|
| `sales` | indigo 234 83% 60% → violet 262 83% 62% | 234 70% 30% → 262 60% 28% | Today's Sales, New Bill CTA |
| `revenue` | sky 206 90% 50% → indigo 234 83% 60% | 206 70% 26% → 234 60% 28% | Month sales, revenue |
| `profit` | emerald 152 62% 40% → teal 172 66% 38% | 152 55% 20% → 172 55% 18% | Gross/Net profit (positive) |
| `expense` | rose 350 80% 58% → orange 20 90% 56% | 350 55% 28% → 20 60% 24% | Expenses, loss |
| `inventory` | amber 38 92% 52% → orange 24 94% 54% | 38 70% 24% → 24 70% 22% | Stock value, low stock |
| `customer` | violet 262 83% 62% → fuchsia 292 76% 58% | 262 55% 28% → 292 50% 24% | Customers, dues |
| `warning` | amber 42 96% 54% → 30 94% 52% | 42 70% 24% → 30 70% 22% | Alerts (overdue, setup needed) |
| `info` | sky 199 89% 52% → cyan 187 80% 44% | 199 70% 24% → 187 60% 20% | Informational |

Rules:
- Text on gradient cards is always `--gradient-foreground` (white in light, near-white in dark). Contrast is verified at ≥ 4.5:1 across the whole gradient.
- Each gradient has a subtle noise or radial highlight overlay (`::before`, 6 % opacity) for depth, and the same glow shadow token.
- At most **4 gradient cards visible per screen**. Everything else uses the neutral `Card`.

## 7. Buttons

shadcn `Button` variants: `default` (primary), `secondary`, `outline`, `ghost`, `link`, `destructive` (danger), plus `success` and `premium` (sales gradient) added in the design system. Sizes: `sm` (36 px), `default` (40 px desktop / **44 px** touch), `lg` (48 px), `icon` (40/44 px square). A loading state replaces the leading icon with a spinner and sets `aria-busy`. Destructive actions always go through `ConfirmDialog` (legacy confirm-modal parity).

## 8. Inputs and forms

- shadcn `Input`, `Select`, `Combobox` (Command + Popover), `Textarea`, `Checkbox`, `Switch`, `RadioGroup`, `DatePicker` (validated to 1990–2200, BR-DAT-02).
- `MoneyInput`: accepts rupees, stores **paise**, right-aligned tabular digits, `inputMode="decimal"`.
- `QtyInput`: up to 3 decimals, stepper buttons on touch.
- `GstinInput`: upper-cases as you type, validates 15 characters, and emits the derived state code (LC-2.1, LC-16.1).
- `FormField` pattern: label above, helper text below, error in `--danger` with an icon, and `aria-describedby` wired up.
- **Enter-as-Tab** (LC-50.2): the `useEnterAdvance` hook on desktop data-entry forms. Product code and global search are excluded (legacy parity). Mobile uses `enterKeyHint="next"`.

## 9. Tables and lists

- Desktop and tablet: TanStack Table with sticky header, column visibility, sortable headers, right-aligned numeric columns, zebra rows via `bg-muted/40`, row hover `bg-accent`, sticky totals footer where relevant, virtualization over 200 rows.
- **Mobile (< 768 px): tables become card lists.** Each column definition declares `mobile: 'title' | 'subtitle' | 'meta' | 'amount' | 'badge' | 'hidden'`, so one definition renders both layouts.
- Filters: a `FilterBar` on desktop becomes a `Filters` bottom sheet with applied-filter chips on mobile.
- Pagination: cursor-based "Load more" (Firestore), not numbered pages.

## 10. Overlays

| Component | Desktop | Mobile |
|---|---|---|
| `ResponsiveDialog` | centered `Dialog` (max-w 560) | bottom `Drawer` (vaul, part of shadcn) with a drag handle |
| `Sheet` | side sheet (right, 420–560 px) for detail and edit | full-height bottom sheet |
| `ConfirmDialog` | `AlertDialog`: focus trap, Esc closes, focus restored (LC-45.2) | same, bottom-anchored |
| `CommandPalette` | Ctrl/Cmd+K global search (LC-50.3) | full-screen search sheet from the top-bar search icon |
| Toasts | Sonner, bottom-right | bottom-center, above the bottom nav (safe-area aware) |

## 11. Navigation

- **Desktop (≥ 1024):** collapsible sidebar (264 px, collapses to a 72 px icon rail) with nav groups (config-driven, permission-filtered, empty groups dropped), the business logo, and a location switcher. Restricted users see a fixed location label (LC-50.10). Top bar: global search, notification bell (low stock + overdue, LC-45.1), theme toggle, profile menu. Version shown in the sidebar footer (LC-2.9).
- **Tablet (768–1023):** icon rail sidebar plus top bar. Landscape tablets may expand the rail.
- **Mobile (< 768):** top app bar (title, search, bell) plus a **bottom navigation** with 5 items: **Home · Sell (New Bill) · Stock · Dues · More**. "More" opens a drawer with the full permission-filtered nav. The Sell item is visually emphasized (a raised center button with the sales gradient). Items the user lacks permission for are replaced from a priority list.

### Mobile-first workflows (spec §13)

| Workflow | Mobile pattern |
|---|---|
| Dashboard | Horizontally scrollable KPI gradient cards, then stacked charts and lists |
| **New Bill** | Full-screen flow: sticky top search/scan bar (camera button) → cart lines as swipeable cards (qty stepper, tap to edit rate/discount in a bottom sheet) → **sticky bottom totals bar** (items, tax, grand total) with **Save**. Customer picker and GST mode (default **Without GST**, DEF-016) in a header chip that opens a bottom sheet. |
| Product search / barcode | Search sheet with recent items. Camera scanner in a full-screen sheet with the rear camera preferred and the scanner kept open on no match (LC-10.3). |
| Customer selection | Searchable bottom sheet with quick add (state defaults to business state). |
| Payments | Record Payment bottom sheet (amount, mode, reference, "also log in Cash Book"). |
| Customer ledger | Card timeline with a running balance and a sticky outstanding header. |
| Inventory / stock | Location-scoped card list with a status filter. Adjust and transfer as bottom sheets. |
| Purchases / expenses | Stepper forms with a sticky Save. |
| Reports | Stacked cards, horizontally scrollable tables only where unavoidable, export in an actions sheet. |
| Invoice viewing | A responsive invoice view (not the PDF) with Print/Share/Download PDF actions. |

## 12. Responsive breakpoints and test targets

| Token | Min width | Layout |
|---|---|---|
| base | 0 | single column, bottom nav, card lists, bottom sheets |
| `sm` | 640 | wider cards, 2-up KPI grid |
| `md` | 768 | icon-rail sidebar, tables allowed, 2-column forms |
| `lg` | 1024 | full sidebar, split views (list + detail sheet), New Bill two-pane (cart + summary) |
| `xl` | 1280 | 4-up KPI grid, denser tables |
| `2xl` | 1536 | max content width 1440 centered, 3-pane New Bill (search results · cart · totals/customer) |

**Required viewport test matrix** (Playwright projects, both themes): 360×800, 390×844, 412×915, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080. Pass criteria: no horizontal page scroll, no clipped primary actions, sticky bars visible, touch targets ≥ 44 px on touch viewports, and every workflow in §11 completable.

Layouts change **structurally** at breakpoints (nav model, table ↔ cards, dialog ↔ drawer, pane count). They are never just shrunk.

## 13. Touch targets

At least **44 × 44 px** for every interactive element on touch devices (`@media (pointer: coarse)` raises `sm` controls to 44 px). At least 8 px spacing between adjacent targets. Primary actions on mobile sit in the bottom third of the screen (thumb zone), in sticky bars that respect `env(safe-area-inset-bottom)`.

## 14. Loading, empty and error states

| State | Pattern |
|---|---|
| Initial load | Skeletons matching the final layout (KPI, table rows, card list). No full-screen spinners except the auth gate. |
| Settings not yet loaded | Skeleton, **never** blank inputs (the intent behind the legacy LC-2.8 banner) |
| Submitting | Button loading state, form disabled, and double-submit prevented (plus server idempotency) |
| Empty | Illustration icon (Lucide in a tinted circle), one-sentence explanation and a primary CTA ("Create your first bill") |
| Filtered empty | "No results for …" plus a clear-filters action |
| Error (recoverable) | Inline alert with Retry. The friendly message comes from the error code (ARCHITECTURE §13). |
| Error (route) | Error boundary card with Reload and Go to Dashboard |
| Offline | Top banner "You're offline — viewing saved data. Saving is paused." Save buttons are disabled with an explanation. |
| Needs confirmation | The legacy-equivalent confirmation (stock shortage, credit limit, overpayment, negative stock) in a `ConfirmDialog` listing each warning |
| Setup banner | Dashboard warning gradient card when the business name or state is missing. A thin warning banner on other pages when the name is empty (BR-ADM-02). |

## 15. Badges

`Badge` variants: `success`, `warning`, `danger`, `info`, `secondary`, `outline`, all tinted (`bg-success/12 text-success border-success/20`). Mapping per §3.1. GST mode chips on invoices: **GST** (primary) and **Without GST** (info).

## 16. Charts

- Recharts, wrapped in `ChartCard` + `ChartContainer` that read `--chart-*` tokens so they re-theme automatically.
- Area/line for trends (Dashboard 14/30/90-day sales trend; **both** "Sales Amount" and "Number of Bills" plotted with a dual axis, fixing the legacy legend mismatch KL-17), bar for Shop Comparison, and donut for category breakdowns (max 6 slices + "Other").
- Axis labels use abbreviated INR (`₹1.2L`, `₹3.4Cr`). Tooltips show the full `formatINR`.
- Accessible: every chart has a visually hidden data table or summary (`aria-describedby`).

## 17. Iconography

Lucide React only, 20 px default (18 in dense tables, 24 in nav), stroke 1.75. A single `icons.ts` map assigns an icon to each domain (sales = `ReceiptIndianRupee`, stock = `Boxes`, and so on) so icons stay consistent.

## 18. Accessibility

- WCAG 2.2 AA: text contrast ≥ 4.5:1 (checked for both themes in CI with axe), non-text contrast ≥ 3:1, focus visible (`ring-2 ring-ring ring-offset-2 ring-offset-background`).
- Full keyboard operability. Skip link (legacy parity, LC-50.7). Focus trap and restore in overlays. Esc closes overlays (LC-50.3/50.4).
- Semantic landmarks, `aria-live="polite"` for totals updates in New Bill and for toasts.
- Money is read with the currency (`aria-label="₹1,234.00"`). Status is never conveyed by color alone (icon and text on every badge).
- `prefers-reduced-motion` and `prefers-contrast: more` are respected (the stronger border token).
- The Playwright suite runs `@axe-core/playwright` on key pages in both themes (dev tooling, OQ-13).

## 19. Content and localization

- The language is English (legacy parity). Currency INR, `en-IN` number formatting, and dates shown as `dd MMM yyyy` (legacy `fmtDate` format NOT VERIFIED; OQ-11).
- All strings live in feature-local `strings.ts` so i18n can be added later without refactoring (i18n itself is not in scope).
