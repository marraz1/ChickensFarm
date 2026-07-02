"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestPasswordResetInput>({ resolver: zodResolver(requestPasswordResetSchema) });

  async function onSubmit(data: RequestPasswordResetInput) {
    await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm">
          Jei toks el. paštas užregistruotas, netrukus gausite nuorodą slaptažodžiui atkurti.
        </p>
        <Link href="/login" className="text-sm font-medium hover:underline">
          Grįžti į prisijungimą
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Įveskite savo el. paštą ir atsiųsime nuorodą slaptažodžiui atkurti.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">El. paštas</Label>
        <Input id="email" type="email" autoComplete="email" className="h-11" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting} className="h-11 mt-2">
        {isSubmitting ? "Siunčiama..." : "Siųsti nuorodą"}
      </Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground hover:underline mt-2">
        Grįžti į prisijungimą
      </Link>
    </form>
  );
}
