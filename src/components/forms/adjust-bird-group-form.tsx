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
import { adjustBirdGroupSchema, type AdjustBirdGroupInput } from "@/lib/validation/bird-groups";
import { birdCategoryLabels } from "@/lib/labels";
import type { BirdCategory } from "@/generated/prisma/client";

export function AdjustBirdGroupForm({
  groupId,
  currentQuantity,
  currentCategory,
}: {
  groupId: string;
  currentQuantity: number;
  currentCategory: BirdCategory;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdjustBirdGroupInput>({
    resolver: zodResolver(adjustBirdGroupSchema),
    defaultValues: { quantity: currentQuantity, category: currentCategory },
  });

  const category = watch("category");

  async function onSubmit(data: AdjustBirdGroupInput) {
    setServerError(null);
    const res = await fetch(`/api/bird-groups/${groupId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push(`/bird-groups/${groupId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Dabartinis kiekis: <span className="font-medium text-foreground">{currentQuantity}</span>. Įvedus
        naują kiekį, skirtumas bus įrašytas kaip rankinė korekcija grupės istorijoje.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Kategorija</Label>
        <Select
          items={birdCategoryLabels}
          value={category ?? currentCategory}
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
        <p className="text-xs text-muted-foreground">
          Paaugus viščiukus galite priskirti prie „Jauniklės vištos" ar „Jaunikliai gaidukai".
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Naujas kiekis</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={0} className="h-11" {...register("quantity", { valueAsNumber: true })} />
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
