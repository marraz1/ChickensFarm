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
import Link from "next/link";
import type { z } from "zod";
import { newExpenseSchema, type CreateExpenseInput } from "@/lib/validation/expenses";
import { expenseAreaChoices, expenseCategoryLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";
import { areaSlugFor, type ExpenseTargetField } from "@/lib/v2-navigation";
import type { FarmArea } from "@/generated/prisma/client";

/**
 * Opening the form from an area (#192, V2ExpenseForm): the area is fixed and
 * shown, and an optional target is offered from that area only.
 */
export type ExpenseAreaContext = {
  area: FarmArea;
  areaLabel: string;
  /** "Keisti": the general expense form, whose "Sritis" offers every area (#193). */
  changeHref: string;
  target: {
    field: ExpenseTargetField;
    label: string;
    options: { id: string; label: string }[];
  };
};

const NO_TARGET = "";
const AREA_HINT = "Išlaida bus įskaičiuota į šios srities ir viso ūkio finansus.";
// A "Bendra" cost belongs to no area (finance rule 1).
const SHARED_HINT = "Išlaida bus įskaičiuota į viso ūkio finansus.";

export function ExpenseForm({
  expenseId,
  defaultValues,
  onSuccessPath = "/expenses",
  areaContext,
  followMovedArea = false,
  targetLabel = null,
}: {
  expenseId?: string;
  defaultValues?: Partial<CreateExpenseInput>;
  onSuccessPath?: string;
  areaContext?: ExpenseAreaContext;
  /** Edit opened from an area's tab: after a move, open the new area's tab. */
  followMovedArea?: boolean;
  /** What the stored expense points at, named in the warning before a move. */
  targetLabel?: string | null;
} = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof newExpenseSchema>, unknown, CreateExpenseInput>({
    // The area is always sent: fixed from an area, else chosen under "Sritis"
    // (#193), which has no default, so a cost is never filed by accident.
    resolver: zodResolver(newExpenseSchema),
    defaultValues: {
      expenseDate: todayInputValue(),
      category: "FEED",
      ...(areaContext ? { area: areaContext.area } : {}),
      ...defaultValues,
    },
  });

  const category = watch("category");
  const targetField = areaContext?.target.field;
  const targetId = targetField ? (watch(targetField) ?? NO_TARGET) : NO_TARGET;
  const chosenArea = watch("area");
  // The general form has no target picker: moving an expense to another area
  // drops the target, which belongs to the old one and would be refused there.
  const isMove = (area: unknown) =>
    !areaContext && expenseId != null && area != null && area !== defaultValues?.area;

  async function onSubmit(data: CreateExpenseInput) {
    setServerError(null);
    const movedWithoutPicker = isMove(data.area);
    const body = movedWithoutPicker
      ? { ...data, birdGroupId: null, motherHenId: null, incubationCycleId: null }
      : data;
    const res = await fetch(expenseId ? `/api/expenses/${expenseId}` : "/api/expenses", {
      method: expenseId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsaugoti");
      return;
    }

    let nextPath = onSuccessPath;
    if (movedWithoutPicker && followMovedArea && data.area) {
      const slug = areaSlugFor(data.area);
      nextPath = slug ? `/areas/${slug}/expenses` : "/expenses";
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {areaContext && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Sritis</span>
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3">
            <span className="text-sm font-medium">{areaContext.areaLabel}</span>
            <Link
              href={areaContext.changeHref}
              className="flex min-h-11 items-center text-sm font-medium text-primary"
            >
              Keisti
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">{AREA_HINT}</p>
        </div>
      )}

      {/* The general form (#193, V2-Expense-Form): the farmer picks the area. */}
      {!areaContext && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Sritis</legend>
          <div className="rounded-lg border">
            {expenseAreaChoices.map((choice) => (
              <label
                key={choice.value}
                className="flex min-h-11 items-center gap-2.5 border-t px-3 text-sm first:border-t-0"
              >
                <input
                  type="radio"
                  value={choice.value}
                  className="size-4 accent-primary"
                  {...register("area")}
                />
                {choice.label}
              </label>
            ))}
          </div>
          {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
          <p className="text-xs text-muted-foreground">
            {chosenArea === "SHARED" ? SHARED_HINT : AREA_HINT}
          </p>
          {targetLabel && isMove(chosenArea) && (
            <p role="status" className="text-sm text-amber-700">
              Išlaida nebebus susieta su „{targetLabel}“.
            </p>
          )}
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expenseDate">Data</Label>
        <Input id="expenseDate" type="date" className="h-11" {...register("expenseDate")} />
        {errors.expenseDate && (
          <p className="text-sm text-destructive">{errors.expenseDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category">Kategorija</Label>
        <Select
          items={expenseCategoryLabels}
          value={category}
          onValueChange={(v) => v && setValue("category", v as CreateExpenseInput["category"])}
        >
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

      {/* Hidden when the area has nothing to pick (as the loss form does). */}
      {areaContext && targetField && areaContext.target.options.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target">{areaContext.target.label}</Label>
          <Select
            items={{
              [NO_TARGET]: "Nenurodyta",
              ...Object.fromEntries(areaContext.target.options.map((o) => [o.id, o.label])),
            }}
            value={targetId}
            onValueChange={(v) => setValue(targetField, v ? v : undefined)}
          >
            <SelectTrigger id="target" className="h-11 w-full">
              <SelectValue placeholder="Nenurodyta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TARGET}>Nenurodyta</SelectItem>
              {areaContext.target.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Suma (€)</Label>
        <Input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="pvz. 12,50"
          className="h-11"
          {...register("amount")}
        />
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
