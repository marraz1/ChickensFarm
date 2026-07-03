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
  createEggCollectionSchema,
  type CreateEggCollectionInput,
} from "@/lib/validation/egg-collections";
import { todayInputValue } from "@/lib/format";

type BirdGroupOption = { id: string; label: string };

export function EggCollectionForm({ birdGroups }: { birdGroups: BirdGroupOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateEggCollectionInput>({
    resolver: zodResolver(createEggCollectionSchema),
    defaultValues: { collectionDate: todayInputValue(), quantity: 1, birdGroupId: "" },
  });

  const birdGroupId = watch("birdGroupId");
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  async function onSubmit(data: CreateEggCollectionInput) {
    setServerError(null);
    const res = await fetch("/api/egg-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push("/eggs/collections");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="collectionDate">Data</Label>
        <Input id="collectionDate" type="date" className="h-11" {...register("collectionDate")} />
        {errors.collectionDate && (
          <p className="text-sm text-destructive">{errors.collectionDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Kiekis</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={1} className="h-11" {...register("quantity", { valueAsNumber: true })} />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      {birdGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birdGroupId">Paukščių grupė (neprivaloma)</Label>
          <Select
            items={groupItems}
            value={birdGroupId ?? ""}
            onValueChange={(v) => setValue("birdGroupId", v ?? "")}
          >
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
        </div>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
