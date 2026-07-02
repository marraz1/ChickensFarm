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
import { createBirdGroupSchema, type CreateBirdGroupInput } from "@/lib/validation/bird-groups";
import { sexLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";

type Breed = { id: string; name: string };

export function BirdGroupForm({ breeds }: { breeds: Breed[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateBirdGroupInput>({
    resolver: zodResolver(createBirdGroupSchema),
    defaultValues: {
      sex: "UNKNOWN",
      quantity: 0,
      birthOrAcquiredDate: todayInputValue(),
    },
  });

  const breedId = watch("breedId");
  const sex = watch("sex");

  async function onSubmit(data: CreateBirdGroupInput) {
    setServerError(null);
    const res = await fetch("/api/bird-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push("/bird-groups");
    router.refresh();
  }

  if (breeds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pirmiausia pridėkite bent vieną veislę.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="breedId">Veislė</Label>
        <Select value={breedId} onValueChange={(v) => v && setValue("breedId", v, { shouldValidate: true })}>
          <SelectTrigger id="breedId" className="h-11 w-full">
            <SelectValue placeholder="Pasirinkite veislę" />
          </SelectTrigger>
          <SelectContent>
            {breeds.map((breed) => (
              <SelectItem key={breed.id} value={breed.id}>
                {breed.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.breedId && <p className="text-sm text-destructive">{errors.breedId.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sex">Lytis</Label>
        <Select value={sex} onValueChange={(v) => v && setValue("sex", v as CreateBirdGroupInput["sex"])}>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Kiekis</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={0} className="h-11" {...register("quantity", { valueAsNumber: true })} />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birthOrAcquiredDate">Gimimo / įsigijimo data</Label>
        <Input id="birthOrAcquiredDate" type="date" className="h-11" {...register("birthOrAcquiredDate")} />
        {errors.birthOrAcquiredDate && (
          <p className="text-sm text-destructive">{errors.birthOrAcquiredDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Pastabos</Label>
        <Input id="notes" className="h-11" {...register("notes")} />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Sukurti grupę"}
      </Button>
    </form>
  );
}
