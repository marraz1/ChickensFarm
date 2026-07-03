"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayInputValue, formatEUR, parseDecimalInput } from "@/lib/format";

// Eggs are sold by the ten (dešimtukas), so the form works in packs and a
// price per 10, while the API/DB keep storing raw egg counts and a per-egg
// price (eggs = packs × 10, unitPrice = pricePerTen / 10). That keeps stock and
// finance reporting unchanged and backward-compatible with older sales.
const toNumber = (v: unknown) => {
  const n = parseDecimalInput(v);
  return Number.isNaN(n) ? undefined : n;
};

const eggSaleFormSchema = z.object({
  saleDate: z.string().min(1, "Įveskite datą"),
  tens: z.preprocess(
    toNumber,
    z.number({ error: "Įveskite kiekį" }).int("Turi būti sveikas skaičius").min(1, "Bent 1 dešimtukas")
  ),
  pricePerTen: z.preprocess(
    toNumber,
    z.number({ error: "Įveskite kainą" }).min(0, "Kaina negali būti neigiama")
  ),
  totalAmount: z.preprocess(toNumber, z.number().min(0).optional()),
  buyer: z.string().trim().max(150).optional().or(z.literal("")),
});
type EggSaleFormInput = z.input<typeof eggSaleFormSchema>;
type EggSaleFormValues = z.output<typeof eggSaleFormSchema>;

export function EggSaleForm({
  saleId,
  defaultValues,
  onSuccessPath = "/eggs/sales",
}: {
  saleId?: string;
  defaultValues?: Partial<EggSaleFormValues>;
  onSuccessPath?: string;
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Treat a stored total that doesn't match packs × price as a manual override
  // so it stays editable instead of being recomputed away.
  const [overrideTotal, setOverrideTotal] = useState(
    defaultValues?.totalAmount != null &&
      Math.abs(defaultValues.totalAmount - (defaultValues.tens ?? 0) * (defaultValues.pricePerTen ?? 0)) > 0.005
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EggSaleFormInput, unknown, EggSaleFormValues>({
    resolver: zodResolver(eggSaleFormSchema),
    defaultValues: { saleDate: todayInputValue(), tens: 1, pricePerTen: 0, ...defaultValues },
  });

  const tens = watch("tens");
  const pricePerTen = watch("pricePerTen");
  const totalAmount = watch("totalAmount");
  const eggCount = (parseDecimalInput(tens) || 0) * 10;
  const computedTotal = (parseDecimalInput(tens) || 0) * (parseDecimalInput(pricePerTen) || 0);

  useEffect(() => {
    if (!overrideTotal) setValue("totalAmount", undefined);
  }, [overrideTotal, setValue]);

  async function onSubmit(data: EggSaleFormValues) {
    setServerError(null);
    const eggs = data.tens * 10;
    const total = overrideTotal && data.totalAmount != null ? data.totalAmount : data.tens * data.pricePerTen;
    const res = await fetch(saleId ? `/api/egg-sales/${saleId}` : "/api/egg-sales", {
      method: saleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleDate: data.saleDate,
        quantity: eggs,
        unitPrice: data.pricePerTen / 10,
        totalAmount: total,
        buyer: data.buyer,
      }),
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
        <Label htmlFor="saleDate">Data</Label>
        <Input id="saleDate" type="date" className="h-11" {...register("saleDate")} />
        {errors.saleDate && <p className="text-sm text-destructive">{errors.saleDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tens">Kiekis (dešimtukais, po 10 vnt.)</Label>
        <Input id="tens" type="number" inputMode="numeric" step={1} min={1} className="h-11" {...register("tens")} />
        <p className="text-xs text-muted-foreground">Iš viso: {eggCount} vnt.</p>
        {errors.tens && <p className="text-sm text-destructive">{errors.tens.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pricePerTen">Kaina už 10 vnt. (€)</Label>
        <Input id="pricePerTen" type="text" inputMode="decimal" className="h-11" placeholder="pvz. 2,00" {...register("pricePerTen")} />
        {errors.pricePerTen && <p className="text-sm text-destructive">{errors.pricePerTen.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="buyer">Pirkėjas (neprivaloma)</Label>
        <Input id="buyer" className="h-11" {...register("buyer")} />
      </div>

      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Suma</span>
          <button
            type="button"
            onClick={() => setOverrideTotal((v) => !v)}
            className="text-xs text-muted-foreground underline"
          >
            {overrideTotal ? "naudoti automatinį" : "koreguoti rankiniu būdu"}
          </button>
        </div>
        {overrideTotal ? (
          <Input
            type="text"
            inputMode="decimal"
            placeholder="pvz. 6,00"
            className="h-11 mt-2"
            {...register("totalAmount")}
          />
        ) : (
          <p className="mt-1 text-xl font-semibold">{formatEUR(totalAmount ?? computedTotal)}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
