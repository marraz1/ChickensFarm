import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privatumo pranešimas — ChickensFarm",
  description:
    "Informacija apie tai, kokius asmens duomenis renka ir kaip juos naudoja ChickensFarm.",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/login" className="text-sm text-muted-foreground hover:underline">
            ← Grįžti į prisijungimą
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold">Privatumo pranešimas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paskutinį kartą atnaujinta 2026-09-09
          </p>

          <div className="mt-6 flex flex-col gap-6 text-sm leading-relaxed">
            <p>
              Šis pranešimas trumpai paaiškina, kokius asmens duomenis ChickensFarm renka, kodėl
              juos renka ir kam jie gali būti perduodami. Tai nėra galutinis teisinis dokumentas —
              tai minimalus, sąžiningas paaiškinimas, kaip veikia sistema.
            </p>

            <section>
              <h2 className="font-medium">Kokius duomenis renkame</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium">Paskyros duomenys:</span> vardas, el. pašto adresas
                  ir slaptažodžio šifruotė (slaptažodis niekada nesaugomas atviru tekstu), naudojami
                  registracijai ir prisijungimui.
                </li>
                <li>
                  <span className="font-medium">Ūkio duomenys:</span> jūsų įvesti paukštininkystės
                  ūkio duomenys — paukščių grupės, kiaušinių surinkimo, pardavimo ir sunaudojimo
                  įrašai, nuostoliai, išlaidos, perėjimo ciklai ir kiti su ūkio valdymu susiję
                  įrašai.
                </li>
                <li>
                  <span className="font-medium">Pranešimų prenumeratos:</span> jei įjungiate
                  priminimus naršyklėje ar telefone, saugomas naršyklės/įrenginio push prenumeratos
                  identifikatorius, kad galėtume atsiųsti priminimą.
                </li>
                <li>
                  <span className="font-medium">Techniniai duomenys:</span> slaptažodžio atkūrimo
                  užklausos ir su jomis susiję laikini žetonai, naudojami tik slaptažodžio atkūrimo
                  procesui.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-medium">Kodėl renkame šiuos duomenis</h2>
              <p className="mt-2">
                Duomenys renkami tik tam, kad galėtume suteikti ChickensFarm paslaugą: sukurti ir
                identifikuoti jūsų paskyrą, leisti valdyti jūsų ūkio įrašus, siųsti jūsų užsakytus
                priminimus ir el. laiškus (pvz., slaptažodžio atkūrimą) bei užtikrinti paskyros
                saugumą. Duomenys nėra naudojami reklamai ir neparduodami tretiesiems asmenims.
              </p>
            </section>

            <section>
              <h2 className="font-medium">Kam perduodami duomenys</h2>
              <p className="mt-2">
                Duomenys tvarkomi naudojant šiuos infrastruktūros paslaugų teikėjus, kurie veikia
                kaip duomenų tvarkytojai:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium">Vercel</span> — programos talpinimas ir veikimas;
                </li>
                <li>
                  <span className="font-medium">Neon</span> — duomenų bazės talpinimas;
                </li>
                <li>
                  <span className="font-medium">Resend</span> — el. laiškų (registracijos
                  patvirtinimo, slaptažodžio atkūrimo, priminimų) siuntimas.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-medium">Duomenų saugojimas ir jūsų teisės</h2>
              <p className="mt-2">
                Duomenys saugomi tol, kol naudojatės paskyra. Norėdami peržiūrėti, pataisyti ar
                pašalinti savo duomenis, susisiekite su ūkio, kuriame turite paskyrą,
                administratoriumi arba sistemos administratoriumi.
              </p>
            </section>

            <section id="pareiskimas">
              <h2 className="font-medium">Privatumo ir duomenų saugumo pareiškimas</h2>
              <p className="mt-2">
                Aplikacijos kūrėjas deda pastangas užtikrinti duomenų saugumą, tačiau negarantuoja
                absoliutaus apsaugos nuo trečiųjų šalių įsilaužimų, techninių gedimų ar kitų
                nenumatytų aplinkybių. Registruodamasis ir naudodamasis paskyra, naudotojas
                patvirtina, kad supranta su tuo susijusią riziką ir sutinka, kad kūrėjas neprisiima
                atsakomybės už galimus nuostolius, kilusius dėl duomenų saugumo pažeidimų,
                nesusijusių su kūrėjo tyčiniais veiksmais ar dideliu aplaidumu. Naudotojas atsisako
                bet kokių pretenzijų šiuo pagrindu, jei tokia atsakomybė nėra privaloma pagal
                galiojančius teisės aktus.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Pareiškimo versija: 1.0</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
