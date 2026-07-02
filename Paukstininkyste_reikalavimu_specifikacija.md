# Paukštininkystės ūkio valdymo sistema
## Reikalavimų specifikacija ir techninė architektūra

**Versija:** 1.0
**Data:** 2026-07-02
**Paskirtis dokumento:** techninė specifikacija, skirta sistemos kūrimui su Claude Code

---

## 1. Sistemos apžvalga

Sistema skirta smulkiems ir vidutiniams paukštininkystės ūkiams registruoti ir valdyti informaciją apie:
- ūkio paukščių sudėtį (veisles, lytis, kiekius, amžių),
- perekšles ir jų priežiūros progresą,
- kiaušinių surinkimą, pardavimus ir pajamas,
- nuostolius (ligos, plėšrūnai, kitos priežastys),
- išlaidas (pašarai, vitaminai, vaistai, produktyvumo gerinimo priemonės),
- dirbtinį perinimą inkubatoriumi nuo kiaušinio iki suaugusio paukščio.

Sistema turi būti pasiekiama internetu, optimizuota mobiliesiems naršyklėms (nes ūkio darbuotojai duomenis dažniausiai ves stovėdami prie narvų/aptvarų su telefonu), ir pastatyta ant **Vercel** (hostingas) + **Neon** (serverless PostgreSQL).

---

## 2. Techninė architektūra

### 2.1 Technologijų stekas (rekomendacija)

| Sluoksnis | Technologija | Pastabos |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + TypeScript | SSR/SSG, puikiai integruojasi su Vercel |
| UI | Tailwind CSS + shadcn/ui | greitas mobile-first dizainas |
| Backend | Next.js API Routes / Server Actions | vienas monorepo, be atskiro backend serverio |
| DB | Neon (Serverless PostgreSQL) | autoscale, veikia gerai su Vercel serverless funkcijomis |
| ORM | Prisma arba Drizzle ORM | tipizuotas duomenų sluoksnis, migracijos |
| Autentifikacija | Auth.js (NextAuth) arba Clerk | el. paštas + slaptažodis, galimybė plėsti į OAuth |
| Failų/nuotraukų saugykla | Vercel Blob arba Cloudinary | perekšlių nuotraukoms |
| Hostingas | Vercel | automatinis CI/CD iš Git |
| Monitoringas | Vercel Analytics + Sentry (klaidoms) | neprivaloma MVP fazėje |

### 2.2 Architektūros principas

Naudojama **serverless monolito** architektūra: vienas Next.js projektas, kuriame:
- puslapiai/komponentai renderinami serverio pusėje (SSR) greitesniam mobile patyrimui,
- API sluoksnis (Route Handlers arba Server Actions) tiesiogiai bendrauja su Neon DB per ORM,
- autentifikacija apsaugo visus maršrutus, išskyrus prisijungimo/registracijos puslapius,
- kiekvienas vartotojas mato tik su savo ūkiu (-iais) susijusius duomenis (multi-tenant per `farm_id` ir `owner_id`).

### 2.3 Aplinkos (environments)

- **Development** – lokalus Neon branch arba lokali Postgres
- **Preview** – automatiniai Vercel preview deploy'ai su atskira Neon branch (Neon palaiko DB branching per PR)
- **Production** – pagrindinė Neon DB + Vercel production domenas

---

## 3. Nefunkciniai reikalavimai

| # | Reikalavimas | Aprašymas |
|---|---|---|
| NF1 | Mobile-first dizainas | Visi puslapiai projektuojami pirmiausia 360–430px pločio ekranui, vėliau plečiami tablet/desktop pagalba responsive breakpoint'ų |
| NF2 | Greitis | Puslapio užkrovimas < 2s 4G tinkle; formos turi veikti be trikčių esant silpnam signalui |
| NF3 | Prieinamumas offline-lite | Formos turi rodyti aiškų klaidos pranešimą, jei nėra ryšio; duomenys neprarandami įvedant (local state prieš submit) |
| NF4 | Saugumas | Slaptažodžiai hash'inami (bcrypt/argon2), visos sesijos per HTTPS, CSRF apsauga formose |
| NF5 | Duomenų izoliacija | Vartotojas gali matyti/redaguoti tik savo ūkio duomenis |
| NF6 | Lokalizacija | Sąsaja lietuvių kalba, datų/valiutos formatas LT (EUR, DD-MM-YYYY) |
| NF7 | Prieinamumas (a11y) | Pakankamas kontrastas, didesni mygtukų paliečiami plotai (min. 44×44px) mobile pirštams |
| NF8 | Skalavimasis | Sistema turi veikti su keliais ūkiais/vartotojais be architektūros pakeitimų |
| NF9 | Duomenų atsarginės kopijos | Neon automatinis point-in-time recovery naudojamas kaip backup strategija |

---

## 4. Vartotojų rolės

| Rolė | Teisės |
|---|---|
| **Ūkio savininkas (Admin)** | Kuria ūkį, kviečia/valdo kitus vartotojus, mato visus duomenis, valdo finansus |
| **Darbuotojas (Worker)** *(neprivaloma MVP, bet numatyti duomenų modelyje)* | Gali įvesti operatyvinius duomenis (surinkimas, nuostoliai) be prieigos prie finansinių ataskaitų |

MVP fazei pakanka vienos rolės (savininkas = pilna prieiga), bet duomenų modelis nuo pat pradžių turi numatyti `role` lauką `farm_users` lentelėje, kad vėliau būtų lengva praplėsti.

---

## 5. Funkciniai reikalavimai

### 5.1 Autentifikacija ir registracija (F1)
- F1.1 Vartotojas gali užsiregistruoti el. paštu + slaptažodžiu
- F1.2 Vartotojas gali prisijungti / atsijungti
- F1.3 Slaptažodžio atkūrimas per el. paštą
- F1.4 Sesijos galiojimas (JWT arba DB session) su automatiniu atnaujinimu

### 5.2 Ūkio valdymas (F2)
- F2.1 Vartotojas gali sukurti ūkį (pavadinimas, adresas/vietovė, ūkio tipas – neprivaloma)
- F2.2 Vartotojas gali turėti kelis ūkius ir tarp jų persijungti
- F2.3 Ūkio redagavimas ir (soft) trynimas

### 5.3 Paukščių veislės (F3)
- F3.1 Prie ūkio galima pridėti paukščių veislę (pavadinimas, paukščio tipas – višta/žąsis/antis/kalakutas ir t.t., aprašymas)
- F3.2 Veislių sąrašo peržiūra, redagavimas, šalinimas

### 5.4 Paukščių grupės / poviljai (F4)
- F4.1 Registruojama paukščių grupė pagal: veislę, lytį (patinas/patelė/nenustatyta), kiekį, amžių (arba gimimo/įsigijimo data, iš kurios amžius skaičiuojamas automatiškai)
- F4.2 Galima koreguoti grupės kiekį (pvz., padidėjo dėl išsiritimo, sumažėjo dėl nuostolio – automatinis ryšys su F9 ir F11 moduliais)
- F4.3 Istorinis grupės pokyčių žurnalas (audit log)

### 5.5 Perekšlės / mamos paukščiai (F5)
- F5.1 Individualus paukštis gali būti pažymėtas kaip perekšlė (susietas su konkrečia grupe arba individualiu įrašu)
- F5.2 Galima pridėti nuotrauką
- F5.3 Galima pridėti laisvo teksto aprašymą, kaip sekasi būti mama
- F5.4 Galimybė pridėti kelis progreso įrašus laike (tarsi "dienoraštis" su data + tekstu + papildoma nuotrauka), kad matytųsi raida

### 5.6 Kiaušinių surinkimas (F6)
- F6.1 Registruojamas surinktas kiaušinių kiekis su data ir (neprivaloma) susieta paukščių grupe
- F6.2 Galima žymėti kokybę/būklę (neprivaloma MVP: sveiki/sudaužyti)

### 5.7 Kiaušinių pardavimai ir pajamos (F7)
- F7.1 Registruojamas parduotų kiaušinių kiekis, data, vieneto kaina, pirkėjas (neprivaloma)
- F7.2 Sistema automatiškai apskaičiuoja gautas pajamas (kiekis × kaina), leidžiama ir rankiniu būdu koreguoti sumą
- F7.3 Ataskaita: parduota vs. surinkta vs. likutis sandėlyje (per periodą)

### 5.8 Nuostoliai (F8)
- F8.1 Registruojamas nuostolio įrašas: data, kiekis, priežasties tipas (**liga** / **plėšrūnas** / **kita**), laisvas komentaras
- F8.2 Nuostolis automatiškai sumažina susietos paukščių grupės kiekį (F4.2)
- F8.3 Ataskaita pagal priežasties tipą per periodą

### 5.9 Išlaidos (F9)
- F9.1 Registruojama išlaida: kategorija (**pašarai** / **vitaminai** / **vaistai** / **produktyvumo gerinimo priemonės** / kita), suma, data, aprašymas
- F9.2 Ataskaita pagal kategoriją per periodą

### 5.10 Perinimas inkubatoriumi (F10)
- F10.1 Registruojamas naujas perinimo ciklas: kiaušinių šaltinis (kilmė – pvz., iš kurios grupės/perekšlės paimti), perinimo pradžios data
- F10.2 Po apšvietimo/patikros registruojama: apvaisintų (gyvybingų) ir neapvaisintų kiaušinių kiekis
- F10.3 Registruojama išsiritimo data ir išsiritusių paukščiukų kiekis
- F10.4 Sekimas laike: kiek jauniklių (viščiukų) išgyveno / kiek užaugo iki tam tikro amžiaus – periodiniai atnaujinimai
- F10.5 Suvestinė/statistika: perinimo efektyvumas (išsiritimo %, išgyvenamumo %) vienam ciklui ir bendrai

### 5.11 Ataskaitų skydelis / Dashboard (F11)
- F11.1 Pagrindinis suvestinis vaizdas: bendras paukščių skaičius, aktyvūs perinimo ciklai, paskutinių 30 d. pajamos/išlaidos, nuostolių suvestinė
- F11.2 Pelno/nuostolio (P&L) ataskaita: pajamos (kiaušinių pardavimas) – išlaidos – nuostolių vertė (jei norima vertinti pinigine išraiška, neprivaloma MVP)
- F11.3 Grafikai: kiaušinių surinkimo dinamika, išlaidų struktūra, nuostolių priežastys

---

## 6. Duomenų modelis (esybės ir pagrindiniai laukai)

```
users
  id, email, password_hash, name, created_at

farms
  id, owner_id -> users.id, name, location, created_at

farm_users  (numatyta ateičiai, MVP – tik owner)
  id, farm_id, user_id, role [owner|worker]

breeds (veislės)
  id, farm_id, name, bird_type [višta|žąsis|antis|kalakutas|kita], description

bird_groups (paukščių grupės)
  id, farm_id, breed_id, sex [male|female|unknown],
  quantity, birth_or_acquired_date, notes, created_at, updated_at

mother_hens (perekšlės)
  id, farm_id, bird_group_id (nullable), name/label,
  photo_url, description, created_at

mother_hen_logs (progreso įrašai)
  id, mother_hen_id, entry_date, note, photo_url

egg_collections (kiaušinių surinkimas)
  id, farm_id, bird_group_id (nullable), collection_date, quantity

egg_sales (kiaušinių pardavimai)
  id, farm_id, sale_date, quantity, unit_price, total_amount, buyer

losses (nuostoliai)
  id, farm_id, bird_group_id (nullable), loss_date, quantity,
  reason_type [disease|predator|other], comment

expenses (išlaidos)
  id, farm_id, expense_date, category [feed|vitamins|medicine|productivity|other],
  amount, description

incubation_cycles (perinimo ciklai)
  id, farm_id, source_description, egg_source_group_id (nullable),
  start_date, eggs_total, eggs_fertile, eggs_infertile,
  hatch_date, hatched_count, notes

incubation_growth_logs (jauniklių sekimas)
  id, incubation_cycle_id, log_date, alive_count, note
```

**Ryšiai (santrauka):**
- `farms 1—N bird_groups, breeds, egg_collections, egg_sales, losses, expenses, incubation_cycles`
- `bird_groups 1—N mother_hens (neprivaloma), losses, egg_collections`
- `mother_hens 1—N mother_hen_logs`
- `incubation_cycles 1—N incubation_growth_logs`

---

## 7. API struktūra (orientacinė)

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/farms
POST   /api/farms
GET    /api/farms/:id
PATCH  /api/farms/:id

GET    /api/farms/:id/breeds
POST   /api/farms/:id/breeds

GET    /api/farms/:id/bird-groups
POST   /api/farms/:id/bird-groups
PATCH  /api/bird-groups/:id

POST   /api/mother-hens
POST   /api/mother-hens/:id/logs

POST   /api/egg-collections
POST   /api/egg-sales
POST   /api/losses
POST   /api/expenses

POST   /api/incubation-cycles
PATCH  /api/incubation-cycles/:id
POST   /api/incubation-cycles/:id/growth-logs

GET    /api/farms/:id/dashboard
```

Visi `POST`/`PATCH`/`DELETE` maršrutai reikalauja aktyvios sesijos ir tikrina, ar `farm_id` priklauso prisijungusiam vartotojui.

---

## 8. UI/UX principai (mobile-first)

- Apatinė navigacija (bottom tab bar) mobiliesiems – 4–5 pagrindiniai skyriai: Pradžia, Paukščiai, Kiaušiniai, Finansai, Perinimas
- Formos – vienas laukas per eilutę, dideli input'ai, native mobile input tipai (number, date)
- Sąrašai su kortelėmis (card layout), ne plačios lentelės, kurios blogai atrodo mobile
- Svarbiausi veiksmai (pvz. "+ Pridėti įrašą") – plaukiojantis mygtukas (FAB) apačioje dešinėje
- Nuotraukų įkėlimas – tiesiogiai iš telefono kameros (`<input type="file" capture>`)
- Progresyvus atskleidimas: sudėtingesni/neprivalomi laukai paslėpti po "daugiau nustatymų"

---

## 9. MVP apimtis vs. vėlesnės fazės

**MVP (1 fazė):**
Registracija/prisijungimas, ūkio kūrimas, veislės, paukščių grupės, kiaušinių surinkimas ir pardavimai, išlaidos, nuostoliai, paprastas dashboard.

**2 fazė:**
Perekšlių modulis su nuotraukomis ir dienoraščiu, perinimo inkubatoriumi modulis su pilnu sekimu.

**3 fazė:**
Kelių vartotojų rolės (darbuotojai), grafikai/analitika, eksportas į Excel/PDF, pranešimai (pvz. priminimas apie perinimo patikrą).

---

## 10. Pastabos kūrimui su Claude Code

- Pradėti nuo Prisma/Drizzle schemos (6 skyrius) ir migracijų sukūrimo Neon DB
- Kiekvienam moduliui (F1–F11) kurti atskirą API route + UI puslapį, testuojant su realiais mobile viewport dydžiais (375px, 390px, 414px)
- Naudoti Vercel preview deploy'us kiekvienam PR su atskira Neon branch – leidžia testuoti be produkcinių duomenų rizikos
- Aplinkos kintamieji (`DATABASE_URL`, `NEXTAUTH_SECRET` ir t.t.) laikyti Vercel Environment Variables, niekada commit'inti į repo
