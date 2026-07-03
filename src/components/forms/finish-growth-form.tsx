"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };
type Mode = "transfer" | "keep";

export function FinishGrowthForm({
  cycleId,
  cohortQuantity,
  groups,
}: {
  cycleId: string;
  cohortQuantity: number;
  groups: Option[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("transfer");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groupItems = Object.fromEntries(groups.map((g) => [g.id, g.label]));

  async function handleSubmit() {
    setServerError(null);
    if (mode === "transfer" && !targetGroupId) {
      setServerError("Pasirinkite grupę, į kurią perkelti");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/incubation-cycles/${cycleId}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferToGroupId: mode === "transfer" ? targetGroupId : "" }),
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

  const modes: { value: Mode; label: string; hint: string }[] = [
    {
      value: "transfer",
      label: "Perkelti į esamą grupę",
      hint: `Visi ${cohortQuantity} paukščiai bus perkelti į pasirinktą grupę.`,
    },
    {
      value: "keep",
      label: "Palikti kaip atskirą grupę",
      hint: "Grupė lieka kaip yra; tik pažymima, kad auginimas baigtas.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cn(
              "rounded-lg border p-3 text-left",
              mode === m.value ? "border-primary ring-1 ring-primary" : ""
            )}
          >
            <p className="text-sm font-medium">{m.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      {mode === "transfer" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetGroup">Grupė</Label>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nėra kitų grupių. Sukurkite grupę arba pasirinkite „Palikti kaip atskirą grupę".
            </p>
          ) : (
            <Select items={groupItems} value={targetGroupId} onValueChange={(v) => v && setTargetGroupId(v)}>
              <SelectTrigger id="targetGroup" className="h-11 w-full">
                <SelectValue placeholder="Pasirinkite grupę" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="button" onClick={handleSubmit} disabled={submitting} className="h-11">
        {submitting ? "Baigiama..." : "Užbaigti sekimą"}
      </Button>
    </div>
  );
}
