# Design snapshot

A snapshot of how the app looks today, kept as source next to the code. It is documentation of the current UI, not a spec for new work.

- Canvas: https://claude.ai/artifact/Ja2FadFrYtLSYrhmEdMenx (private to the owner unless shared)
- Look: stock shadcn/ui base-nova on Tailwind v4, taken from `src/app/globals.css` and `src/components/ui`
- Format: each `*.dc.html` is one 390-wide phone artboard; `canvas.json` holds their layout on the canvas, one row per feature. File names are prefixed by feature.

## Features

| Feature | Files | Source in `src` |
| --- | --- | --- |
| Core: dashboard, nav, login | `Main`, `Dashboard-dark`, `Quick-add`, `Login`, `Birds` (hub) | `app/(app)/page.tsx`, `components/layout/*`, `app/(auth)/login` |
| Egg collection, incubation list | `Egg-collections`, `Egg-new`, `Incubation` | `app/(app)/eggs/collections`, `app/(app)/incubation/page.tsx` |
| Account access | `Auth-Register`, `Auth-Forgot`, `Auth-Forgot-sent`, `Auth-Privacy` | `app/(auth)/*`, `app/privacy` |
| Farms | `Farms-List`, `Farms-New`, `Farms-Settings`, `Farms-Delete` | `app/(app)/farms/*` |
| Bird groups and breeds | `Groups-List`, `Groups-Detail`, `Groups-Form`, `Breeds-List`, `Breeds-Form` | `app/(app)/bird-groups/*`, `app/(app)/breeds/*` |
| Bird trading and meat use | `Trade-Purchases`, `Trade-Sales`, `Trade-Form`, `Meat-List`, `Meat-Form` | `app/(app)/birds/{purchases,sales,consumptions}`, `components/bird-transaction-list.tsx` |
| Eggs: consumption, sales, reports | `Eggs-Consumption-List`, `Eggs-Consumption-Form`, `Eggs-Sales-List`, `Eggs-Sales-Form`, `Eggs-Report` | `app/(app)/eggs/{consumptions,sales,reports}` |
| Mother hens | `Hens-List`, `Hens-Detail`, `Hens-Form`, `Hens-Log-Form` | `app/(app)/mother-hens/*` |
| Incubation cycles | `Inc-New`, `Inc-Detail-Early`, `Inc-Detail-Hatched`, `Inc-Growth-Form`, `Inc-Finish` | `app/(app)/incubation/*`, `components/forms/{candling,hatch,growth-log,finish-growth}-form.tsx` |
| Losses | `Losses-List`, `Losses-Form`, `Losses-Report` | `app/(app)/losses/*` |
| Expenses | `Expenses-List`, `Expenses-Form`, `Expenses-Report` | `app/(app)/expenses/*` |
| Finance | `Finance-Hub`, `Finance-ProfitLoss` | `app/(app)/finance/*` |
| Profile | `Profile-Home`, `Profile-Notifications`, `Profile-Feedback` | `app/(app)/profile/*` |

## Not designed

Edit screens for existing records (they reuse the form screens), the empty states of each list, the push-install hint on the notifications screen, and the select dropdowns shown open.

## Notes

- The `.dc.html` files render only inside the canvas editor (they load its `support.js` runtime). In the repo they are versioned source and a record.
- Figures, farm name and record names are sample data, not real farm data.
- The login logo is a stand-in icon, not `public/icon-maskable-512.png`. Photos are grey placeholders.
- Where a form's markup was not read in full (egg sale, meat use, hen forms), field order follows the labels in the source and may differ slightly.
- If the UI changes, the code is the source of truth; update these files to match.
