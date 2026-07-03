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
import { updateBirdGroupSchema, type UpdateBirdGroupInput } from "@/lib/validation/bird-groups";
import { sexLabels, birdCategoryLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";
import type { Sex, BirdCategory } from "@/generated/prisma/client";

type Breed = { id: string; name: string };
type ExistingGroup = { id: string; breedId: string; sex: Sex; category: BirdCategory };

export function BirdGroupForm({
  breeds,
  existingGroups,
  groupId,
  defaultValues,
  onSuccessPath,
}: {
  breeds: Breed[];
  existingGroups: ExistingGroup[];
  groupId?: string;
  defaultValues?: Partial<UpdateBirdGroupInput>;
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
  } = useForm<UpdateBirdGroupInput>({
    resolver: zodResolver(updateBirdGroupSchema),
    defaultValues: {
      breedId: "",
      name: "",
      sex: "UNKNOWN",
      category: "LAYER",
      quantity: 0,
      birthOrAcquiredDate: todayInputValue(),
      ...defaultValues,
    },
  });

  const breedId = watch("breedId");
  const sex = watch("sex");
  const category = watch("category");

  // F4 — warn (not block) when an identical breed+lytis+kategorija group already
  // exists, so the user can decide to keep the duplicate or edit the existing one.
  const duplicate = existingGroups.find(
    (g) => g.id !== groupId && g.breedId === breedId && g.sex === sex && g.category === category
  );

  async function onSubmit(data: UpdateBirdGroupInput) {
    setServerError(null);
    const res = await fetch(groupId ? `/api/bird-groups/${groupId}` : "/api/bird-groups", {
      method: groupId ? "PATCH" : "POST",
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
        <Select items={Object.fromEntries(breeds.map((b) => [b.id, b.name]))} value={breedId ?? ""} onValueChange={(v) => v && setValue("breedId", v, { shouldValidate: true })}>
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
        <Label htmlFor="name">Pavadinimas (neprivaloma)</Label>
        <Input id="name" className="h-11" placeholder="pvz. Vištidė A" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Kategorija</Label>
        <Select items={birdCategoryLabels} value={category} onValueChange={(v) => v && setValue("category", v as BirdCategory)}>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sex">Lytis</Label>
        <Select items={sexLabels} value={sex} onValueChange={(v) => v && setValue("sex", v as Sex)}>
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

      {duplicate && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Jau turite tos pačios veislės, lyties ir kategorijos grupę. Galite tęsti arba grįžti ir
          koreguoti esamą grupę.
        </p>
      )}

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

      {groupId && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adjustmentNote">Korekcijos priežastis (jei keičiate kiekį)</Label>
          <Input id="adjustmentNote" className="h-11" {...register("adjustmentNote")} />
          <p className="text-xs text-muted-foreground">
            Pakeitus kiekį, skirtumas bus įrašytas į grupės istoriją kaip rankinė korekcija.
          </p>
        </div>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : groupId ? "Išsaugoti" : "Sukurti grupę"}
      </Button>
    </form>
  );
}
