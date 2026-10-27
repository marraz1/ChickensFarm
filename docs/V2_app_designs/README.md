# ChickensFarm V2 — app designs

Design for the next version of the app. It does not describe the current app (that snapshot lives in `docs/design/`) and nothing here changes it.

- Canvas: https://claude.ai/artifact/Ja2FadFrYtLSYrhmEdMenx, page **"V2 · sritys"** (private to the owner unless shared)
- Look: unchanged from V1 — shadcn/ui base-nova tokens from `src/app/globals.css`, Geist, 44px touch targets, Lithuanian copy
- Format: each `*.dc.html` is one 390-wide phone artboard; they render only in the canvas editor and serve here as source and reference

## What changes in V2

The farm is split into four **areas** (sritys). Each area has its own records, expenses, losses and finances, and one page shows the finances of the whole farm.

| Area                  | Key    | Covers                                                                            |
| --------------------- | ------ | --------------------------------------------------------------------------------- |
| Kiaušiniai ir prekyba | `Eggs` | Laying flock, egg collection, egg sales and consumption, bird purchases and sales |
| Perekšlės             | `Hens` | Mother hens and their diary                                                       |
| Perinimas             | `Inc`  | Incubation cycles, candling, hatching, chick growth                               |
| Mėsiniai paukščiai    | `Meat` | Birds raised for meat, meat use, meat-bird sales                                  |

### Navigation

- **Bottom bar** (`V2Nav`): Apžvalga · Kiaušiniai · Perekšlės · Perinimas · Mėsa. Replaces V1's Pradžia / Paukščiai / + / Finansai / Perinimas.
- **Area tabs** (`V2Tabs`), the same in every area: Apžvalga · Išlaidos · Nuostoliai · Finansai.
- **Header** (`V2Header`): farm switcher and profile, as in V1.
- **Adding records**: the centre "+" button is gone. Each area's page header has a primary button:
  - Apžvalga tab → "Naujas" opens the area's add sheet (`V2-<Area>-New`)
  - Išlaidos tab → "Išlaida" opens the area's expense form
  - Nuostoliai tab → "Nuostolis" opens the area's loss form

### Finance model

- Every expense belongs to exactly one area **or** to "Bendra" (shared costs such as electricity or fencing).
- Opening the expense form from an area pre-fills that area; the general form (`V2-Expense-Form`, from the overview) asks for it.
- An expense can optionally point at a target inside the area: a laying or meat group, a mother hen, or an incubation cycle.
- Income is attributed by where it comes from: egg sales and bird sales → Kiaušiniai; chick sales → Perinimas; meat-bird sales → Mėsa.
- Losses get their area from what was lost (group, hen or cycle), so the loss form asks for that target, not the area.
- Meat used at home is shown as a count, not as income.
- The overview's area rows plus the "Bendros išlaidos" row add up to the farm total.

## Screens

### Farm level

| File               | Screen                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `V2-Overview`      | Apžvalga (interactive): period switch, farm result, donut by area, expandable area tiles, "Ūkis dabar" boxes, more |
| `V2-Overview-Open` | The same page with the Kiaušiniai tile opened, its slice focused and "Daugiau statistikos" expanded                |
| `V2-Expense-Form`  | General expense form with the area chooser (incl. "Bendra")                                                        |

#### Apžvalga behaviour

- **Donut "Pagal sritį"**: switch between Išlaidos and Pajamos. Each area keeps its colour in both views. Tapping a legend row highlights that slice and shows its amount and share in the centre; tapping it again clears it.
- **Area colours** (fixed per area, never by rank): Kiaušiniai `#2a78d6`, Perekšlės `#eb6834`, Perinimas `#1baf7a`, Mėsa `#eda100`, Bendros `#e87ba4`. Checked with the dataviz palette validator on white (all checks pass). Three sit below 3:1 contrast, so every slice also has a text label with its percentage.
- **Area tiles**: two per row with result, income and expenses. Tapping a tile widens it to full width and opens details: income and expenses, top expense categories, losses, last three months, and links to the area and its finance tab. One tile is open at a time.
- **Ūkis dabar**: four small boxes (egg stock, birds, active cycles, losses) that link to the matching area.
- **Daugiau statistikos**: collapsed by default; holds spend by category and the farm's months.

### Per area

Same set for every area; replace `<Area>` with `Eggs`, `Hens`, `Inc` or `Meat`.

| File                    | Screen                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| `V2-<Area>-Overview`    | Area overview: stat cards, balance, records or items                     |
| `V2-<Area>-Expenses`    | Area expenses: total, by category, records                               |
| `V2-<Area>-Losses`      | Area losses: total, by cause, area-specific extras, records              |
| `V2-<Area>-Finance`     | Area finance: result, income and expenses, by category, months           |
| `V2-<Area>-New`         | "Naujas" bottom sheet with the area's record types plus expense and loss |
| `V2-<Area>-Expense-New` | Expense form, area pre-filled                                            |
| `V2-<Area>-Loss-New`    | Loss form, area pre-filled                                               |

Area-specific content worth noting:

- **Eggs** losses show broken eggs from collections next to dead birds.
- **Hens** losses show an empty state; finance notes that hatched chicks are counted under Perinimas.
- **Inc** losses count dead chicks plus infertile and unhatched eggs; finance shows cost per hatched chick.
- **Meat** losses estimate the feed value lost; finance shows cost per bird and notes home use.

### Shared components

| File            | Props                                                                    | Used by                 |
| --------------- | ------------------------------------------------------------------------ | ----------------------- |
| `V2Header`      | —                                                                        | every V2 screen         |
| `V2Nav`         | `active`: overview, eggs, hens, inc, meat                                | every V2 screen         |
| `V2Tabs`        | `sec`: Eggs, Hens, Inc, Meat; `tab`: overview, expenses, losses, finance | area screens            |
| `V2ExpenseForm` | `sec`                                                                    | `V2-<Area>-Expense-New` |
| `V2LossForm`    | `sec`                                                                    | `V2-<Area>-Loss-New`    |

## Reused V1 screens

V2 keeps the record forms and lists whose fields do not change. Links from V2 screens point to these files in `docs/design/`:

`Egg-new`, `Egg-collections`, `Eggs-Sales-Form`, `Eggs-Sales-List`, `Eggs-Consumption-Form`, `Eggs-Consumption-List`, `Trade-Form`, `Trade-Purchases`, `Trade-Sales`, `Groups-Form`, `Groups-List`, `Hens-Form`, `Hens-Detail`, `Hens-Log-Form`, `Inc-New`, `Inc-Detail-Early`, `Inc-Detail-Hatched`, `Inc-Growth-Form`, `Meat-Form`, `Meat-List`, `Losses-Form`, `Profile-Home`.

When these screens are built for V2 they take the V2 header and bottom bar; their fields stay as designed.

## Notes and open items

- Figures are sample data, chosen to be consistent: area results sum to the farm total of −348,50 € for 2026.
- Some derived numbers are proposals, not existing calculations: profit margin, cost per hatched chick, cost per meat bird, estimated feed value lost.
- Not designed: dark mode for V2, edit screens for existing records, empty states for every list, the area chooser on the loss form when opened outside an area.
- Data impact to plan: an area field (or `SHARED`) on expenses, area derivation for income and losses, and assigning existing bird groups to Kiaušiniai or Mėsa.
