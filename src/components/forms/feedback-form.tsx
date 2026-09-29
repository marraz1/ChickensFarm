"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FEEDBACK_MAX_LENGTH, feedbackSchema, type FeedbackInput } from "@/lib/validation/feedback";

export function FeedbackForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { message: "" },
  });

  const length = useWatch({ control, name: "message" })?.length ?? 0;

  async function onSubmit(data: FeedbackInput) {
    setServerError(null);
    setSent(false);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setServerError(body?.error ?? "Nepavyko išsiųsti");
      return;
    }

    reset({ message: "" });
    setSent(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Jūsų atsiliepimas</Label>
        <textarea
          id="message"
          rows={6}
          maxLength={FEEDBACK_MAX_LENGTH}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
          placeholder="Kas veikia gerai, kas trukdo, ko trūksta..."
          {...register("message", { onChange: () => setSent(false) })}
        />
        <div className="flex justify-between gap-2">
          {errors.message ? (
            <p className="text-sm text-destructive">{errors.message.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            {length}/{FEEDBACK_MAX_LENGTH}
          </span>
        </div>
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      {sent && (
        <p className="text-sm text-muted-foreground" role="status">
          Ačiū! Atsiliepimas išsiųstas.
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Siunčiama..." : "Siųsti"}
      </Button>
    </form>
  );
}
