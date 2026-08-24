"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch, SwitchThumb } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DEFAULT_TIME_ZONE } from "@/lib/notification-schedule";
import {
  notificationSettingSchema,
  notificationSettingDefaults,
  type NotificationSettingInput,
} from "@/lib/validation/notifications";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function NotificationSettingsForm({
  defaultValues,
  lastSentAt,
  accountEmail,
}: {
  defaultValues?: Partial<NotificationSettingInput>;
  lastSentAt?: string | null;
  accountEmail?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NotificationSettingInput>({
    resolver: zodResolver(notificationSettingSchema),
    defaultValues: { ...notificationSettingDefaults, ...defaultValues },
  });

  const enabled = watch("enabled");
  const channel = watch("channel");

  async function onSubmit(data: NotificationSettingInput) {
    setServerError(null);
    setSaved(false);
    // The zone is captured silently on every save, so a permanent move corrects
    // itself the next time the user touches this screen.
    const res = await fetch("/api/notification-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, timeZone: browserTimeZone() }),
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="enabled">Priminimai įjungti</Label>
        <Switch
          id="enabled"
          checked={enabled}
          onCheckedChange={(checked) => setValue("enabled", checked, { shouldDirty: true })}
        >
          <SwitchThumb />
        </Switch>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Priminimo tekstas</Label>
        <Input id="message" className="h-11" maxLength={300} {...register("message")} />
        {errors.message && <p className="text-sm text-destructive">{errors.message.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">El. paštas</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="h-11"
          placeholder={accountEmail}
          {...register("email")}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        <p className="text-xs text-muted-foreground">
          {accountEmail
            ? `Palikus tuščią, priminimai siunčiami paskyros adresu (${accountEmail}).`
            : "Palikus tuščią, priminimai siunčiami paskyros adresu."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sendTime">Laikas</Label>
        <Input id="sendTime" type="time" className="h-11" {...register("sendTime")} />
        {errors.sendTime && <p className="text-sm text-destructive">{errors.sendTime.message}</p>}
        <p className="text-xs text-muted-foreground">
          Pagal jūsų įrenginio laiko juostą ({browserTimeZone()}). Priminimas siunčiamas tik tuomet,
          jei tą dieną dar neįvedėte kiaušinių surinkimo.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Pranešimo tipas</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setValue("channel", "EMAIL", { shouldDirty: true })}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium",
              channel === "EMAIL"
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <Mail size={16} aria-hidden />
            El. paštas
          </button>
          <button
            type="button"
            disabled
            className="flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg border text-sm font-medium text-muted-foreground opacity-50"
          >
            <Smartphone size={16} aria-hidden />
            Telefone
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pranešimai telefone bus galimi vėliau — įsidiegus programėlę į telefono pradžios ekraną.
        </p>
      </div>

      {lastSentAt && (
        <p className="text-xs text-muted-foreground">Paskutinis priminimas: {lastSentAt}</p>
      )}

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {saved && <p className="text-sm text-emerald-600">Išsaugota.</p>}
      <Button type="submit" disabled={isSubmitting} className="mt-2 h-11">
        {isSubmitting ? "Saugoma..." : "Išsaugoti"}
      </Button>
    </form>
  );
}
