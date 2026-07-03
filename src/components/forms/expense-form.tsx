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
import { createExpenseSchema, type CreateExpenseInput } from "@/lib/validation/expenses";
import { expenseCategoryLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";

export function ExpenseForm({
  expenseId,
  defaultValues,
  onSuccessPath = "/expenses",
}: {
  expenseId?: string;
  defaultValues?: Partial<CreateExpenseInput>;
  onSuccessPath?: string;
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { expenseDate: todayInputValue(), category: "FEED", ...defaultValues },
  });

  const category = watch("category");

  async function onSubmit(data: CreateExpenseInput) {
    setServerError(null);
    const res = await fetch(expenseId ? `/api/expenses/${expenseId}` : "/api/expenses", {
      method: expenseId ? "PATCH" : "POST",
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
        <Label htmlFor="expenseDate">Data</Label>
        <Input id="expenseDate" type="date" className="h-11" {...register("expenseDate")} />
        {errors.expenseDate && <p className="text-sm text-destructive">{errors.expenseDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Kategorija</Label>
        <Select items={expenseCategoryLabels} value={category} onValueChange={(v) => v && setValue("category", v as CreateExpenseInput["category"])}>
          <SelectTrigger id="category" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(expenseCategoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Suma (€)</Label>
        <Input id="amount" type="number" step="0.01" inputMode="decimal" min={0} className="h-11" {...register("amount", { valueAsNumber: true })} />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
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
