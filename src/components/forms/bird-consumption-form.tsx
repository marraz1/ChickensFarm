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
  createBirdConsumptionSchema,
  type CreateBirdConsumptionInput,
} from "@/lib/validation/bird-consumptions";
import { todayInputValue } from "@/lib/format";

type BirdGroupOption = { id: string; label: string };

export function BirdConsumptionForm({
  birdGroups,
  consumptionId,
  defaultValues,
  onSuccessPath = "/birds/consumptions",
}: {
  birdGroups: BirdGroupOption[];
  consumptionId?: string;
  defaultValues?: Partial<CreateBirdConsumptionInput>;
  onSuccessPath?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateBirdConsumptionInput>({
    resolver: zodResolver(createBirdConsumptionSchema),
    defaultValues: {
      consumptionDate: todayInputValue(),
      quantity: 1,
      birdGroupId: "",
      note: "",
      ...defaultValues,
    },
  });

  const birdGroupId = watch("birdGroupId");
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  async function onSubmit(data: CreateBirdConsumptionInput) {
    setServerError(null);
    const res = await fetch(
      consumptionId ? `/api/bird-consumptions/${consumptionId}` : "/api/bird-consumptions",
      {
        method: consumptionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push(onSuccessPath);
    router.refresh();
  }

  // Nothing to take birds out of — say so rather than showing a form whose only
  // required field cannot be filled.
  if (birdGroups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Pirmiausia sukurkite paukščių grupę.
      </p>
    );
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
        <Label htmlFor="birdGroupId">Paukščių grupė</Label>
        <Select
          items={groupItems}
          value={birdGroupId ?? ""}
          onValueChange={(v) => setValue("birdGroupId", v ?? "")}
        >
          <SelectTrigger id="birdGroupId" className="h-11 w-full">
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
        {errors.birdGroupId && (
          <p className="text-sm text-destructive">{errors.birdGroupId.message}</p>
        )}
        <p className="text-xs text-muted-foreground">Grupės kiekis bus automatiškai sumažintas.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Kiekis</Label>
        <Input
          id="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          className="h-11"
          {...register("quantity", { valueAsNumber: true })}
        />
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
