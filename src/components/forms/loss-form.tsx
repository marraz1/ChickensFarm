"use client";

import { useForm, type Resolver } from "react-hook-form";
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
import { createLossSchema, type CreateLossInput } from "@/lib/validation/losses";
import { lossReasonLabels } from "@/lib/labels";
import { todayInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExpenseTargetField } from "@/lib/v2-navigation";
import type { FarmArea } from "@/generated/prisma/client";

type BirdGroupOption = { id: string; label: string };

/**
 * Opening the form from an area (#195, V2LossForm): the area is fixed and
 * shown, and the loss is recorded against a required target from that area.
 */
export type LossAreaContext = {
  area: Exclude<FarmArea, "SHARED">;
  areaLabel: string;
  target: {
    field: ExpenseTargetField;
    label: string;
    hint: string;
    quantityLabel: string;
    requiredMessage: string;
    options: { id: string; label: string }[];
  };
};

/**
 * Editing a hen's or cycle's loss (#195): what was lost and how many cannot
 * change (nor a cycle loss's date), so they are shown, not offered.
 */
export type LossLockedTarget = { label: string; value: string; lockDate: boolean };

const zodLossResolver = zodResolver(createLossSchema) as Resolver<CreateLossInput>;

export function LossForm({
  birdGroups = [],
  lossId,
  defaultValues,
  onSuccessPath = "/losses",
  areaContext,
  lockedTarget,
}: {
  birdGroups?: BirdGroupOption[];
  lossId?: string;
  defaultValues?: Partial<CreateLossInput>;
  onSuccessPath?: string;
  areaContext?: LossAreaContext;
  lockedTarget?: LossLockedTarget;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const target = areaContext?.target;
  // A mother hen is one bird (the server requires exactly 1).
  const quantityLocked = target?.field === "motherHenId" || !!lockedTarget;

  // In an area the target is required; say which one is missing in the
  // area's own words rather than the schema's generic message.
  const resolver: Resolver<CreateLossInput> = async (values, context, options) => {
    const result = await zodLossResolver(values, context, options);
    if (target && !values[target.field]) {
      return {
        values: {},
        errors: {
          ...result.errors,
          [target.field]: { type: "required", message: target.requiredMessage },
        },
      };
    }
    return result;
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateLossInput>({
    resolver,
    defaultValues: {
      lossDate: todayInputValue(),
      quantity: 1,
      // "Liga" first in V2, as designed; the V1 form keeps "Kita".
      reasonType: areaContext ? "DISEASE" : "OTHER",
      ...(areaContext ? { area: areaContext.area } : { birdGroupId: "" }),
      ...defaultValues,
    },
  });

  const reasonType = watch("reasonType");
  const birdGroupId = watch("birdGroupId");
  const targetId = target ? (watch(target.field) ?? "") : "";
  const groupItems = Object.fromEntries(birdGroups.map((g) => [g.id, g.label]));

  async function onSubmit(data: CreateLossInput) {
    setServerError(null);
    const res = await fetch(lossId ? `/api/losses/${lossId}` : "/api/losses", {
      method: lossId ? "PATCH" : "POST",
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
      {areaContext && target && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Sritis</span>
            <div className="flex min-h-11 items-center rounded-lg border bg-muted/40 px-3 text-sm font-medium">
              {areaContext.areaLabel}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target">{target.label}</Label>
            <Select
              items={Object.fromEntries(target.options.map((o) => [o.id, o.label]))}
              value={targetId}
              onValueChange={(v) => setValue(target.field, v ? v : undefined)}
            >
              <SelectTrigger id="target" className="h-11 w-full">
                <SelectValue placeholder="Pasirinkite" />
              </SelectTrigger>
              <SelectContent>
                {target.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[target.field] && (
              <p className="text-sm text-destructive">{errors[target.field]?.message}</p>
            )}
            {target.options.length === 0 && (
              <p className="text-sm text-muted-foreground">Šioje srityje nėra ką pasirinkti.</p>
            )}
            <p className="text-xs text-muted-foreground">{target.hint}</p>
          </div>
        </>
      )}

      {lockedTarget && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{lockedTarget.label}</span>
          <div className="flex min-h-11 items-center rounded-lg border bg-muted/40 px-3 text-sm font-medium">
            {lockedTarget.value}
          </div>
          <p className="text-xs text-muted-foreground">
            {lockedTarget.lockDate ? "Objekto, datos ir kiekio" : "Objekto ir kiekio"} pakeisti
            negalima. Jei reikia, ištrinkite įrašą ir įrašykite iš naujo.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lossDate">Data</Label>
        <Input
          id="lossDate"
          type="date"
          readOnly={lockedTarget?.lockDate}
          className="h-11"
          {...register("lossDate")}
        />
        {errors.lossDate && <p className="text-sm text-destructive">{errors.lossDate.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">{target?.quantityLabel ?? "Kiekis"}</Label>
        <Input
          id="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          readOnly={quantityLocked}
          className="h-11"
          {...register("quantity", { valueAsNumber: true })}
        />
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label id="reason-label">Priežastis</Label>
        <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="reason-label">
          {Object.entries(lossReasonLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={reasonType === value}
              onClick={() => setValue("reasonType", value as CreateLossInput["reasonType"])}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium",
                reasonType === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!areaContext && !lockedTarget && birdGroups.length > 0 && (
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
            Jei nurodysite grupę, jos kiekis bus automatiškai sumažintas.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comment">Komentaras</Label>
        <Input
          id="comment"
          className="h-11"
          placeholder={areaContext ? "pvz. lapė, šlubavo" : undefined}
          {...register("comment")}
        />
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
