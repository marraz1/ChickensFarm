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
import { createBreedSchema, type CreateBreedInput } from "@/lib/validation/breeds";
import { birdTypeLabels } from "@/lib/labels";

export function BreedForm({
  breedId,
  defaultValues,
  onSuccessPath,
}: {
  breedId?: string;
  defaultValues?: Partial<CreateBreedInput>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateBreedInput>({
    resolver: zodResolver(createBreedSchema),
    defaultValues,
  });

  const birdType = watch("birdType");

  async function onSubmit(data: CreateBreedInput) {
    setServerError(null);
    const res = await fetch(breedId ? `/api/breeds/${breedId}` : "/api/breeds", {
      method: breedId ? "PATCH" : "POST",
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
        <Label htmlFor="name">Veislės pavadinimas</Label>
        <Input id="name" className="h-11" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birdType">Paukščio tipas</Label>
        <Select items={birdTypeLabels} value={birdType} onValueChange={(v) => v && setValue("birdType", v as CreateBreedInput["birdType"], { shouldValidate: true })}>
          <SelectTrigger id="birdType" className="h-11 w-full">
            <SelectValue placeholder="Pasirinkite tipą" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(birdTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.birdType && <p className="text-sm text-destructive">{errors.birdType.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Aprašymas</Label>
        <Input id="description" className="h-11" {...register("description")} />
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
