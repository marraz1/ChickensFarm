"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  createIncubationCycleSchema,
  type CreateIncubationCycleInput,
} from "@/lib/validation/incubation";
import { todayInputValue } from "@/lib/format";

type BirdGroupOption = { id: string; label: string };

export function IncubationCycleForm({ birdGroups }: { birdGroups: BirdGroupOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateIncubationCycleInput>({
    resolver: zodResolver(createIncubationCycleSchema),
    defaultValues: { name: "", startDate: todayInputValue(), sourceDescription: "", eggSourceGroupId: "", notes: "" },
  });

  const eggSourceGroupId = watch("eggSourceGroupId");
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  async function onSubmit(data: CreateIncubationCycleInput) {
    setServerError(null);
    const res = await fetch("/api/incubation-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push("/incubation");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Pavadinimas</Label>
        <Input id="name" className="h-11" placeholder="pvz. Liepos partija" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Perinimo pradžios data</Label>
        <Input id="startDate" type="date" className="h-11" {...register("startDate")} />
        {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eggsTotal">Kiaušinių kiekis (neprivaloma)</Label>
        <Input
          id="eggsTotal"
          type="number"
          inputMode="numeric"
          min={0}
          className="h-11"
          {...register("eggsTotal", { setValueAs: (v) => (v === "" ? undefined : Number(v)) })}
        />
      </div>

      {birdGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eggSourceGroupId">Kiaušinių šaltinis (grupė, neprivaloma)</Label>
          <Select items={groupItems} value={eggSourceGroupId ?? ""} onValueChange={(v) => setValue("eggSourceGroupId", v ?? "")}>
            <SelectTrigger id="eggSourceGroupId" className="h-11 w-full">
              <SelectValue placeholder="Nenurodyta" />
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sourceDescription">Kilmės aprašymas (neprivaloma)</Label>
        <Input
          id="sourceDescription"
          className="h-11"
          placeholder="pvz. iš perekšlės Rita"
          {...register("sourceDescription")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Pastabos</Label>
        <Input id="notes" className="h-11" {...register("notes")} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Pradėti ciklą"}
      </Button>
    </form>
  );
}
