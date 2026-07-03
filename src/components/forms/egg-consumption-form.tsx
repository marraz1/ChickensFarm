"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEggConsumptionSchema,
  type CreateEggConsumptionInput,
} from "@/lib/validation/egg-consumptions";
import { todayInputValue } from "@/lib/format";

export function EggConsumptionForm({
  consumptionId,
  defaultValues,
  onSuccessPath = "/eggs/consumptions",
}: {
  consumptionId?: string;
  defaultValues?: Partial<CreateEggConsumptionInput>;
  onSuccessPath?: string;
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEggConsumptionInput>({
    resolver: zodResolver(createEggConsumptionSchema),
    defaultValues: { consumptionDate: todayInputValue(), quantity: 1, note: "", ...defaultValues },
  });

  async function onSubmit(data: CreateEggConsumptionInput) {
    setServerError(null);
    const res = await fetch(consumptionId ? `/api/egg-consumptions/${consumptionId}` : "/api/egg-consumptions", {
      method: consumptionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push(onSuccessPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="consumptionDate">Data</Label>
        <Input id="consumptionDate" type="date" className="h-11" {...register("consumptionDate")} />
        {errors.consumptionDate && (
          <p className="text-sm text-destructive">{errors.consumptionDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Suvartota (vnt.)</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={1} className="h-11" {...register("quantity", { valueAsNumber: true })} />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
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
