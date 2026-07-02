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
import { createLossSchema, type CreateLossInput } from "@/lib/validation/losses";
import { lossReasonLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

type BirdGroupOption = { id: string; label: string };

export function LossForm({ birdGroups }: { birdGroups: BirdGroupOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateLossInput>({
    resolver: zodResolver(createLossSchema),
    defaultValues: { lossDate: todayInputValue(), quantity: 1, reasonType: "OTHER", birdGroupId: "" },
  });

  const reasonType = watch("reasonType");
  const birdGroupId = watch("birdGroupId");

  async function onSubmit(data: CreateLossInput) {
    setServerError(null);
    const res = await fetch("/api/losses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push("/losses");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lossDate">Data</Label>
        <Input id="lossDate" type="date" className="h-11" {...register("lossDate")} />
        {errors.lossDate && <p className="text-sm text-destructive">{errors.lossDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Kiekis</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={1} className="h-11" {...register("quantity", { valueAsNumber: true })} />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Priežastis</Label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(lossReasonLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue("reasonType", value as CreateLossInput["reasonType"])}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium",
                reasonType === value ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {birdGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birdGroupId">Paukščių grupė (neprivaloma)</Label>
          <Select value={birdGroupId ?? ""} onValueChange={(v) => setValue("birdGroupId", v ?? "")}>
            <SelectTrigger id="birdGroupId" className="h-11 w-full">
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
          <p className="text-xs text-muted-foreground">
            Jei nurodysite grupę, jos kiekis bus automatiškai sumažintas.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comment">Komentaras</Label>
        <Input id="comment" className="h-11" {...register("comment")} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
