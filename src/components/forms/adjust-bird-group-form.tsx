"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustBirdGroupSchema, type AdjustBirdGroupInput } from "@/lib/validation/bird-groups";

export function AdjustBirdGroupForm({
  groupId,
  currentQuantity,
}: {
  groupId: string;
  currentQuantity: number;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdjustBirdGroupInput>({
    resolver: zodResolver(adjustBirdGroupSchema),
    defaultValues: { quantity: currentQuantity },
  });

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
