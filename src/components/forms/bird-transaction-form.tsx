"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import type { BirdTransactionType } from "@/generated/prisma/client";
import { birdTransactionCounterpartyLabels } from "@/lib/labels";
import { todayInputValue, formatEUR, parseDecimalInput } from "@/lib/format";

// Birds are bought and sold by the head, so the form works in whole birds and a
// price per bird — no pack conversion like eggs need. The total is computed as
// quantity × price, with a manual override for a hand-agreed lump sum.
const toNumber = (v: unknown) => {
  const n = parseDecimalInput(v);
  return Number.isNaN(n) ? undefined : n;
};

const birdTransactionFormSchema = z.object({
  transactionDate: z.string().min(1, "Įveskite datą"),
  quantity: z.preprocess(
    toNumber,
    z
      .number({ error: "Įveskite kiekį" })
      .int("Turi būti sveikas skaičius")
      .min(1, "Kiekis turi būti bent 1"),
  ),
  unitPrice: z.preprocess(
    toNumber,
    z.number({ error: "Įveskite kainą" }).min(0, "Kaina negali būti neigiama"),
  ),
  totalAmount: z.preprocess(toNumber, z.number().min(0).optional()),
  birdGroupId: z.string().optional().or(z.literal("")),
  counterparty: z.string().trim().max(150).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
type BirdTransactionFormInput = z.input<typeof birdTransactionFormSchema>;
type BirdTransactionFormValues = z.output<typeof birdTransactionFormSchema>;

type BirdGroupOption = { id: string; label: string };

export function BirdTransactionForm({
  type,
  birdGroups,
  transactionId,
  defaultValues,
  onSuccessPath,
}: {
  type: BirdTransactionType;
  birdGroups: BirdGroupOption[];
  transactionId?: string;
  defaultValues?: Partial<BirdTransactionFormValues>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  // Treat a stored total that doesn't match quantity × price as a manual
  // override so it stays editable instead of being recomputed away.
  const [overrideTotal, setOverrideTotal] = useState(
    defaultValues?.totalAmount != null &&
      Math.abs(
        defaultValues.totalAmount - (defaultValues.quantity ?? 0) * (defaultValues.unitPrice ?? 0),
      ) > 0.005,
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BirdTransactionFormInput, unknown, BirdTransactionFormValues>({
    resolver: zodResolver(birdTransactionFormSchema),
    defaultValues: {
      transactionDate: todayInputValue(),
      quantity: 1,
      unitPrice: 0,
      birdGroupId: "",
      ...defaultValues,
    },
  });

  const quantity = watch("quantity");
  const unitPrice = watch("unitPrice");
  const totalAmount = watch("totalAmount");
  const birdGroupId = watch("birdGroupId");
  const computedTotal = (parseDecimalInput(quantity) || 0) * (parseDecimalInput(unitPrice) || 0);
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  useEffect(() => {
    if (!overrideTotal) setValue("totalAmount", undefined);
  }, [overrideTotal, setValue]);

  async function onSubmit(data: BirdTransactionFormValues) {
    setServerError(null);
    const total =
      overrideTotal && data.totalAmount != null ? data.totalAmount : data.quantity * data.unitPrice;
    const res = await fetch(
      transactionId ? `/api/bird-transactions/${transactionId}` : "/api/bird-transactions",
      {
        method: transactionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          transactionDate: data.transactionDate,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          totalAmount: total,
          birdGroupId: data.birdGroupId,
          counterparty: data.counterparty,
          note: data.note,
        }),
      },
    );

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
        <Label htmlFor="transactionDate">Data</Label>
        <Input id="transactionDate" type="date" className="h-11" {...register("transactionDate")} />
        {errors.transactionDate && (
          <p className="text-sm text-destructive">{errors.transactionDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Kiekis (vnt.)</Label>
        <Input
          id="quantity"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          className="h-11"
          {...register("quantity")}
        />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unitPrice">Kaina už paukštį (€)</Label>
        <Input
          id="unitPrice"
          type="text"
          inputMode="decimal"
          className="h-11"
          placeholder="pvz. 8,50"
          {...register("unitPrice")}
        />
        {errors.unitPrice && <p className="text-sm text-destructive">{errors.unitPrice.message}</p>}
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
          <p className="text-xs text-muted-foreground">
            {type === "PURCHASE"
              ? "Jei nurodysite grupę, jos kiekis bus automatiškai padidintas."
              : "Jei nurodysite grupę, jos kiekis bus automatiškai sumažintas."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="counterparty">
          {birdTransactionCounterpartyLabels[type]} (neprivaloma)
        </Label>
        <Input id="counterparty" className="h-11" {...register("counterparty")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Pastaba</Label>
        <Input id="note" className="h-11" {...register("note")} />
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
            placeholder="pvz. 85,00"
            className="h-11 mt-2"
            {...register("totalAmount")}
          />
        ) : (
          <p className="mt-1 text-xl font-semibold">{formatEUR(totalAmount ?? computedTotal)}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {type === "PURCHASE"
            ? "Bus įskaičiuota į išlaidas ir bendrą balansą."
            : "Bus įskaičiuota į pajamas ir bendrą balansą."}
        </p>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
