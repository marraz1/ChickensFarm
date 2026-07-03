"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
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
import { todayInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  hatchDate: z.string().min(1, "Įveskite datą"),
  hatchedCount: z.number().int().min(0),
});
type FormInput = z.infer<typeof formSchema>;

type Option = { id: string; label: string };
type TargetMode = "none" | "new" | "existing";

export function HatchForm({
  cycleId,
  breeds,
  birdGroups,
}: {
  cycleId: string;
  breeds: Option[];
  birdGroups: Option[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<TargetMode>("new");
  const [breedId, setBreedId] = useState("");
  const [birdGroupId, setBirdGroupId] = useState("");
  const breedItems = Object.fromEntries(breeds.map((b) => [b.id, b.label]));
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { hatchDate: todayInputValue(), hatchedCount: 0 },
  });

  async function onSubmit(data: FormInput) {
    setServerError(null);

    let target: Record<string, unknown> = { mode: "none" };
    if (data.hatchedCount > 0) {
      if (mode === "new") {
        if (!breedId) return setServerError("Pasirinkite naujos grupės veislę");
        target = { mode: "new", breedId };
      } else if (mode === "existing") {
        if (!birdGroupId) return setServerError("Pasirinkite esamą grupę");
        target = { mode: "existing", birdGroupId };
      }
    }

    const res = await fetch(`/api/incubation-cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "hatch", ...data, target }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.refresh();
  }

  const modeButtons: { value: TargetMode; label: string }[] = [
    { value: "new", label: "Nauja grupė" },
    { value: "existing", label: "Esama grupė" },
    { value: "none", label: "Nekurti" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hatchDate">Išsiritimo data</Label>
          <Input id="hatchDate" type="date" className="h-11" {...register("hatchDate")} />
          {errors.hatchDate && <p className="text-sm text-destructive">{errors.hatchDate.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hatchedCount">Išsirito (vnt.)</Label>
          <Input id="hatchedCount" type="number" inputMode="numeric" min={0} className="h-11" {...register("hatchedCount", { valueAsNumber: true })} />
          {errors.hatchedCount && <p className="text-sm text-destructive">{errors.hatchedCount.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Kur įtraukti jauniklius?</Label>
        <div className="grid grid-cols-3 gap-2">
          {modeButtons.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setMode(b.value)}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium",
                mode === b.value ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pasirinkus grupę, jos kiekis bus automatiškai padidintas ir įrašytas į istoriją.
        </p>
      </div>

      {mode === "new" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="breedId">Naujos grupės veislė</Label>
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
          <p className="text-xs text-muted-foreground">
            Grupė bus sukurta kaip „Viščiukai". Paaugus galėsite atskirti į jauniklės vištas ir
            gaidukus grupės kortelėje.
          </p>
        </div>
      )}

      {mode === "existing" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="existingGroup">Esama grupė</Label>
          <Select items={groupItems} value={birdGroupId} onValueChange={(v) => v && setBirdGroupId(v)}>
            <SelectTrigger id="existingGroup" className="h-11 w-full">
              <SelectValue placeholder="Pasirinkite grupę" />
            </SelectTrigger>
            <SelectContent>
              {birdGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11">
        {isSubmitting ? "Saugoma..." : "Registruoti išsiritimą"}
      </Button>
    </form>
  );
}
