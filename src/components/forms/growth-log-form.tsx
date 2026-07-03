"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGrowthLogSchema, type CreateGrowthLogInput } from "@/lib/validation/incubation";
import { todayInputValue } from "@/lib/format";

export function GrowthLogForm({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGrowthLogInput>({
    resolver: zodResolver(createGrowthLogSchema),
    defaultValues: { logDate: todayInputValue(), aliveCount: 0, note: "" },
  });

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
