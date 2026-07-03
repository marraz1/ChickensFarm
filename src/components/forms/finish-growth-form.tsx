"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { birdCategoryLabels } from "@/lib/labels";
import type { BirdCategory } from "@/generated/prisma/client";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; label: string };

const NEW_GROUP = "__new__";

type Entry = {
  key: number;
  targetGroupId: string; // NEW_GROUP or a group id
  category: BirdCategory;
  count: number;
};

export function FinishGrowthForm({
  cycleId,
  available,
  groups,
  breeds,
  defaultBreedId,
}: {
  cycleId: string;
  available: number;
  groups: Option[];
  breeds: Option[];
  defaultBreedId: string;
}) {
  const router = useRouter();
  const [breedId, setBreedId] = useState(defaultBreedId);
  const [entries, setEntries] = useState<Entry[]>([
    { key: 1, targetGroupId: NEW_GROUP, category: "PULLET", count: available },
  ]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groupSelectItems = { [NEW_GROUP]: "➕ Nauja grupė", ...Object.fromEntries(groups.map((g) => [g.id, g.label])) };
  const breedItems = Object.fromEntries(breeds.map((b) => [b.id, b.label]));
  const hasNewEntry = entries.some((e) => e.targetGroupId === NEW_GROUP);
  const total = entries.reduce((s, e) => s + (Number(e.count) || 0), 0);

  function updateEntry(key: number, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }
  function addEntry() {
    setEntries((prev) => [
      ...prev,
      { key: Math.max(0, ...prev.map((e) => e.key)) + 1, targetGroupId: NEW_GROUP, category: "COCKEREL", count: 0 },
    ]);
  }
  function removeEntry(key: number) {
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev));
  }

  async function handleSubmit() {
    setServerError(null);
    if (total > available) {
      setServerError(`Negalima paskirstyti daugiau nei turima (${available})`);
      return;
    }
    if (hasNewEntry && !breedId) {
      setServerError("Pasirinkite naujų grupių veislę");
      return;
    }
    if (entries.some((e) => !e.count || e.count < 1)) {
      setServerError("Kiekvienam perkėlimui įveskite kiekį");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/incubation-cycles/${cycleId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breedId: hasNewEntry ? breedId : "",
        entries: entries.map((e) => ({
          targetGroupId: e.targetGroupId === NEW_GROUP ? "" : e.targetGroupId,
          category: e.category,
          count: e.count,
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko užbaigti");
      setSubmitting(false);
      return;
    }

    router.push(`/incubation/${cycleId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Turima <span className="font-medium text-foreground">{available}</span> jauniklių. Paskirstykite
        juos į grupes — galite pridėti kelis perkėlimus (pvz. dedeklės ir gaidukai atskirai).
      </p>

      {hasNewEntry && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="breedId">Naujų grupių veislė</Label>
          <Select items={breedItems} value={breedId} onValueChange={(v) => v && setBreedId(v)}>
            <SelectTrigger id="breedId" className="h-11 w-full">
              <SelectValue placeholder="Pasirinkite veislę" />
            </SelectTrigger>
            <SelectContent>
              {breeds.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {entries.map((entry, idx) => (
          <div key={entry.key} className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Perkėlimas {idx + 1}</p>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.key)}
                  aria-label="Pašalinti"
                  className="text-muted-foreground"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Į grupę</Label>
                <Select
                  items={groupSelectItems}
                  value={entry.targetGroupId}
                  onValueChange={(v) => v && updateEntry(entry.key, { targetGroupId: v })}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_GROUP}>➕ Nauja grupė</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {entry.targetGroupId === NEW_GROUP && (
                <div className="flex flex-col gap-1.5">
                  <Label>Kategorija</Label>
                  <Select
                    items={birdCategoryLabels}
                    value={entry.category}
                    onValueChange={(v) => v && updateEntry(entry.key, { category: v as BirdCategory })}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(birdCategoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Kiekis</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="h-11"
                  value={entry.count}
                  onChange={(e) => updateEntry(entry.key, { count: e.target.valueAsNumber || 0 })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addEntry}
        className="flex h-11 items-center justify-center gap-1 rounded-lg border text-sm font-medium"
      >
        <Plus size={16} aria-hidden /> Pridėti perkėlimą
      </button>

      <p className={`text-sm ${total > available ? "text-destructive" : "text-muted-foreground"}`}>
        Paskirstyta {total} iš {available}
      </p>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="button" onClick={handleSubmit} disabled={submitting} className="h-11">
        {submitting ? "Baigiama..." : "Užbaigti sekimą"}
      </Button>
    </div>
  );
}
