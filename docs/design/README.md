# Design snapshot

A snapshot of how the app looks today, kept as source next to the code. It is documentation of the current UI, not a spec for new work.

- Canvas: https://claude.ai/artifact/Ja2FadFrYtLSYrhmEdMenx (private to the owner unless shared)
- Look: stock shadcn/ui base-nova on Tailwind v4, taken from `src/app/globals.css` and `src/components/ui`
- Format: each `*.dc.html` is one 390-wide phone artboard; `canvas.json` holds their layout on the canvas, one row per feature

## Features covered

| Feature | Files | Source in `src` |
| --- | --- | --- |
| Core (dashboard, nav) | `Main`, `Dashboard-dark`, `Quick-add`, `Login`, `Birds` (hub) | `app/(app)/page.tsx`, `components/layout/*`, `app/(auth)/login` |
| Eggs (so far) | `Egg-collections`, `Egg-new` | `app/(app)/eggs/collections`, `components/forms/egg-collection-form.tsx` |
| Incubation (so far) | `Incubation` (list) | `app/(app)/incubation/page.tsx` |
| Account access | `Auth-Register`, `Auth-Forgot`, `Auth-Forgot-sent`, `Auth-Privacy` | `app/(auth)/*`, `app/privacy` |
| Farms | `Farms-List`, `Farms-New`, `Farms-Settings`, `Farms-Delete` | `app/(app)/farms/*`, `components/forms/farm-form.tsx`, `delete-farm-button.tsx` |
| Bird groups and breeds | `Groups-List`, `Groups-Detail`, `Groups-Form`, `Breeds-List`, `Breeds-Form` | `app/(app)/bird-groups/*`, `app/(app)/breeds/*` |

## Not designed yet

Bird purchases, sales and meat use; egg consumption, sales and reports; mother hens; incubation detail, candling, hatch, growth and finish; losses; expenses; finance hub and profit/loss; profile, notifications and feedback. Some screens link to files that do not exist yet (`Finance-Hub`, `Profile-Home`); those links are placeholders.

## Notes

- The `.dc.html` files render only inside the canvas editor (they load its `support.js` runtime). In the repo they are versioned source and a record.
- Figures, farm name and record names are sample data, not real farm data.
- The login logo is a stand-in icon, not `public/icon-maskable-512.png`.
- If the UI changes, the code is the source of truth; update these files to match.
