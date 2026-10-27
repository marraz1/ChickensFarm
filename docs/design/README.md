# Design snapshot

A snapshot of how the app looks today, kept as source next to the code. It is documentation of the current UI, not a spec for new work.

- Canvas: https://claude.ai/artifact/Ja2FadFrYtLSYrhmEdMenx (private to the owner unless shared)
- Look: stock shadcn/ui base-nova on Tailwind v4, taken from `src/app/globals.css` and `src/components/ui`
- Format: each `*.dc.html` is one 390×844 phone artboard; `canvas.json` holds their layout on the canvas

| File | Screen | Source in `src` |
| --- | --- | --- |
| `Main.dc.html` | Pradžia (dashboard) | `app/(app)/page.tsx` |
| `Dashboard-dark.dc.html` | Pradžia, dark theme | same, `.dark` tokens |
| `Quick-add.dc.html` | Pridėti įrašą sheet | `components/layout/quick-add.tsx` |
| `Login.dc.html` | Prisijungimas | `app/(auth)/login/page.tsx` |
| `Birds.dc.html` | Paukščiai hub | `app/(app)/birds/page.tsx` |
| `Egg-collections.dc.html` | Kiaušinių surinkimas list | `app/(app)/eggs/collections/page.tsx` |
| `Egg-new.dc.html` | New collection form | `components/forms/egg-collection-form.tsx` |
| `Incubation.dc.html` | Perinimas list | `app/(app)/incubation/page.tsx` |

## Notes

- The `.dc.html` files render only inside the canvas editor (they load its `support.js` runtime). In the repo they are versioned source and a record.
- Figures, farm name and record names are sample data, not real farm data.
- The login logo is a stand-in icon, not `public/icon-maskable-512.png`.
- Not covered: finance, expenses, losses, mother-hens, farms and profile screens.
- If the UI changes, the code is the source of truth; update these files to match.
