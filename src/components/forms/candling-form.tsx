"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  eggsFertile: z.number().int().min(0),
  eggsInfertile: z.number().int().min(0),
});
type FormInput = z.infer<typeof formSchema>;

export function CandlingForm({
  cycleId,
  defaultValues,
}: {
  cycleId: string;
  defaultValues: { eggsFertile: number; eggsInfertile: number };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema), defaultValues });

  async function onSubmit(data: FormInput) {
    setServerError(null);
    setSaved(false);
    const res = await fetch(`/api/incubation-cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "candling", ...data }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eggsFertile">Apvaisinti</Label>
          <Input id="eggsFertile" type="number" inputMode="numeric" min={0} className="h-11" {...register("eggsFertile", { valueAsNumber: true })} />
          {errors.eggsFertile && <p className="text-sm text-destructive">{errors.eggsFertile.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eggsInfertile">Neapvaisinti</Label>
          <Input id="eggsInfertile" type="number" inputMode="numeric" min={0} className="h-11" {...register("eggsInfertile", { valueAsNumber: true })} />
          {errors.eggsInfertile && <p className="text-sm text-destructive">{errors.eggsInfertile.message}</p>}
        </div>
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {saved && <p className="text-sm text-emerald-600">Išsaugota</p>}
      <Button type="submit" variant="outline" disabled={isSubmitting} className="h-11">
        {isSubmitting ? "Saugoma..." : "Išsaugoti apšvietimą"}
      </Button>
    </form>
  );
}
