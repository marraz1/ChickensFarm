"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEggSaleSchema, type CreateEggSaleInput } from "@/lib/validation/egg-sales";
import { todayInputValue, formatEUR } from "@/lib/format";

export function EggSaleForm({
  saleId,
  defaultValues,
  onSuccessPath = "/eggs/sales",
}: {
  saleId?: string;
  defaultValues?: Partial<CreateEggSaleInput>;
  onSuccessPath?: string;
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // When editing, treat a stored total that doesn't match quantity × price as a
  // manual override so it stays editable instead of being recomputed away.
  const [overrideTotal, setOverrideTotal] = useState(
    defaultValues?.totalAmount != null &&
      Math.abs(defaultValues.totalAmount - (defaultValues.quantity ?? 0) * (defaultValues.unitPrice ?? 0)) > 0.005
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateEggSaleInput>({
    resolver: zodResolver(createEggSaleSchema),
    defaultValues: { saleDate: todayInputValue(), quantity: 1, unitPrice: 0, ...defaultValues },
  });

  const quantity = watch("quantity");
  const unitPrice = watch("unitPrice");
  const totalAmount = watch("totalAmount");
  const computedTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  useEffect(() => {
    if (!overrideTotal) {
      setValue("totalAmount", undefined);
    }
  }, [overrideTotal, setValue]);

  async function onSubmit(data: CreateEggSaleInput) {
    setServerError(null);
    const res = await fetch(saleId ? `/api/egg-sales/${saleId}` : "/api/egg-sales", {
      method: saleId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        totalAmount: overrideTotal ? data.totalAmount : undefined,
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
        <Label htmlFor="quantity">Kiekis</Label>
        <Input id="quantity" type="number" inputMode="numeric" min={1} className="h-11" {...register("quantity", { valueAsNumber: true })} />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unitPrice">Vieneto kaina (€)</Label>
        <Input id="unitPrice" type="number" step="0.01" inputMode="decimal" min={0} className="h-11" {...register("unitPrice", { valueAsNumber: true })} />
        {errors.unitPrice && <p className="text-sm text-destructive">{errors.unitPrice.message}</p>}
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
            type="number"
            step="0.01"
            inputMode="decimal"
            className="h-11 mt-2"
            {...register("totalAmount", { valueAsNumber: true })}
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
