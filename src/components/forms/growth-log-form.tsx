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
import { createGrowthLogSchema, type CreateGrowthLogInput } from "@/lib/validation/incubation";
import { birdCategoryLabels, sexLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";
import type { BirdCategory, Sex } from "@/generated/prisma/client";

// When a resulting cohort exists, the form also lets the user reclassify the growing
// chicks (category + sex).
export function GrowthLogForm({
  cycleId,
  cohort,
}: {
  cycleId: string;
  cohort: { category: BirdCategory; sex: Sex } | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateGrowthLogInput>({
    resolver: zodResolver(createGrowthLogSchema),
    defaultValues: {
      logDate: todayInputValue(),
      aliveCount: 0,
      note: "",
      category: cohort?.category,
      sex: cohort?.sex,
    },
  });

  const category = watch("category");
  const sex = watch("sex");

  async function onSubmit(data: CreateGrowthLogInput) {
    setServerError(null);
    const res = await fetch(`/api/incubation-cycles/${cycleId}/growth-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push(`/incubation/${cycleId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="logDate">Data</Label>
        <Input id="logDate" type="date" className="h-11" {...register("logDate")} />
        {errors.logDate && <p className="text-sm text-destructive">{errors.logDate.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aliveCount">Gyvų jauniklių</Label>
        <Input id="aliveCount" type="number" inputMode="numeric" min={0} className="h-11" {...register("aliveCount", { valueAsNumber: true })} />
        {errors.aliveCount && <p className="text-sm text-destructive">{errors.aliveCount.message}</p>}
      </div>

      {cohort && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Kategorija</Label>
            <Select
              items={birdCategoryLabels}
              value={category ?? cohort.category}
              onValueChange={(v) => v && setValue("category", v as BirdCategory)}
            >
              <SelectTrigger id="category" className="h-11 w-full">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sex">Lytis</Label>
            <Select items={sexLabels} value={sex ?? cohort.sex} onValueChange={(v) => v && setValue("sex", v as Sex)}>
              <SelectTrigger id="sex" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sexLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Kategorija ir lytis atnaujina jauniklių grupę (pvz. paaugę tampa „Jauniklės vištos").
            </p>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Pastaba (neprivaloma)</Label>
        <Input id="note" className="h-11" {...register("note")} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
