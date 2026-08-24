"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch, SwitchThumb } from "@/components/ui/switch";
import { DEFAULT_TIME_ZONE } from "@/lib/notification-schedule";
import { PushSetupError, disablePush, enablePush } from "@/lib/push-client";
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
  vapidPublicKey,
}: {
  defaultValues?: Partial<NotificationSettingInput>;
  lastSentAt?: string | null;
  accountEmail?: string;
  /** Passed from the server so the key never has to become a NEXT_PUBLIC_ var.
   *  Null when VAPID is unconfigured — the push toggle then stays disabled. */
  vapidPublicKey?: string | null;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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
  const emailEnabled = watch("emailEnabled");
  const pushEnabled = watch("pushEnabled");

  /**
   * Browser setup runs before the field flips, and the field is only set once it
   * succeeded — otherwise the UI would claim push is on while no subscription
   * exists, and the user would wait for notifications that can never arrive.
   */
  async function onPushToggle(next: boolean) {
    setPushError(null);
    setTestResult(null);

    if (!next) {
      setValue("pushEnabled", false, { shouldDirty: true });
      await disablePush().catch(() => {});
      return;
    }

    if (!vapidPublicKey) {
      setPushError("Pranešimai telefone nesukonfigūruoti serveryje.");
      return;
    }

    setPushBusy(true);
    try {
      await enablePush(vapidPublicKey);
      setValue("pushEnabled", true, { shouldDirty: true });
    } catch (err) {
      setPushError(
        err instanceof PushSetupError ? err.message : "Nepavyko įjungti pranešimų telefone.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function onSendTest() {
    setTestResult(null);
    setPushError(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPushError(body?.error ?? "Nepavyko išsiųsti bandomojo pranešimo.");
      return;
    }
    setTestResult("Bandomasis pranešimas išsiųstas.");
  }

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

      <div className="flex flex-col gap-3">
        <Label>Pranešimo būdas</Label>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">El. paštu</span>
          <Switch
            id="emailEnabled"
            checked={emailEnabled}
            onCheckedChange={(checked) => setValue("emailEnabled", checked, { shouldDirty: true })}
          >
            <SwitchThumb />
          </Switch>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">Telefone</span>
          <Switch
            id="pushEnabled"
            checked={pushEnabled}
            disabled={pushBusy || !vapidPublicKey}
            onCheckedChange={onPushToggle}
          >
            <SwitchThumb />
          </Switch>
        </div>

        {errors.emailEnabled && (
          <p className="text-sm text-destructive">{errors.emailEnabled.message}</p>
        )}
        {pushError && <p className="text-sm text-destructive">{pushError}</p>}
        {testResult && <p className="text-sm text-emerald-600">{testResult}</p>}

        {pushEnabled && (
          <Button type="button" variant="outline" className="h-11" onClick={onSendTest}>
            Siųsti bandomąjį
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          {vapidPublicKey
            ? "Pranešimai telefone veikia įsidiegus programėlę į pradžios ekraną."
            : "Pranešimai telefone šiuo metu neprieinami."}
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
