"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoUpload } from "@/components/forms/photo-upload";
import {
  createMotherHenLogSchema,
  type CreateMotherHenLogInput,
} from "@/lib/validation/mother-hens";
import { todayInputValue } from "@/lib/format";

export function MotherHenLogForm({ motherHenId }: { motherHenId: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateMotherHenLogInput>({
    resolver: zodResolver(createMotherHenLogSchema),
    defaultValues: { entryDate: todayInputValue(), note: "", photoUrl: "" },
  });

  const photoUrl = watch("photoUrl");

  async function onSubmit(data: CreateMotherHenLogInput) {
    setServerError(null);
    const res = await fetch(`/api/mother-hens/${motherHenId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    router.push(`/mother-hens/${motherHenId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="entryDate">Data</Label>
        <Input id="entryDate" type="date" className="h-11" {...register("entryDate")} />
        {errors.entryDate && <p className="text-sm text-destructive">{errors.entryDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Įrašas</Label>
        <textarea
          id="note"
          rows={3}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
          placeholder="Kaip sekasi šiandien..."
          {...register("note")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Nuotrauka</Label>
        <PhotoUpload
          value={photoUrl ?? ""}
          onChange={(url) => setValue("photoUrl", url)}
          folder="mother-hen-logs"
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Pridėti įrašą"}
      </Button>
    </form>
  );
}
