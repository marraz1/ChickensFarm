"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFarmSchema, type CreateFarmInput } from "@/lib/validation/farms";

export function FarmForm({
  farmId,
  defaultValues,
  onSuccessPath,
}: {
  farmId?: string;
  defaultValues?: Partial<CreateFarmInput>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFarmInput>({
    resolver: zodResolver(createFarmSchema),
    defaultValues,
  });

  async function onSubmit(data: CreateFarmInput) {
    setServerError(null);
    const res = await fetch(farmId ? `/api/farms/${farmId}` : "/api/farms", {
      method: farmId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    if (!farmId) {
      const farm = await res.json();
      await fetch("/api/active-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: farm.id }),
      });
    }

    router.push(onSuccessPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Ūkio pavadinimas</Label>
        <Input id="name" className="h-11" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Adresas / vietovė</Label>
        <Input id="location" className="h-11" {...register("location")} />
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : farmId ? "Išsaugoti" : "Sukurti ūkį"}
      </Button>
    </form>
  );
}
