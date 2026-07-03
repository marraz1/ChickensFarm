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
import { PhotoUpload } from "@/components/forms/photo-upload";
import { createMotherHenSchema, type CreateMotherHenInput } from "@/lib/validation/mother-hens";

type BirdGroupOption = { id: string; label: string };

export function MotherHenForm({
  birdGroups,
  henId,
  defaultValues,
  onSuccessPath = "/mother-hens",
}: {
  birdGroups: BirdGroupOption[];
  henId?: string;
  defaultValues?: Partial<CreateMotherHenInput>;
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
  } = useForm<CreateMotherHenInput>({
    resolver: zodResolver(createMotherHenSchema),
    defaultValues: { name: "", birdGroupId: "", photoUrl: "", description: "", ...defaultValues },
  });

  const birdGroupId = watch("birdGroupId");
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));
  const photoUrl = watch("photoUrl");

  async function onSubmit(data: CreateMotherHenInput) {
    setServerError(null);
    const res = await fetch(henId ? `/api/mother-hens/${henId}` : "/api/mother-hens", {
      method: henId ? "PATCH" : "POST",
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
        <Label htmlFor="name">Vardas / žyma</Label>
        <Input id="name" className="h-11" placeholder="pvz. Rita" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Nuotrauka</Label>
        <PhotoUpload
          value={photoUrl ?? ""}
          onChange={(url) => setValue("photoUrl", url)}
          folder="mother-hens"
        />
      </div>

      {birdGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="birdGroupId">Paukščių grupė (neprivaloma)</Label>
          <Select items={groupItems} value={birdGroupId ?? ""} onValueChange={(v) => setValue("birdGroupId", v ?? "")}>
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Aprašymas</Label>
        <textarea
          id="description"
          rows={3}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
          placeholder="Kaip sekasi būti mama..."
          {...register("description")}
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
