"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Generic "delete this record" button + confirm dialog. Shared by the record
// types that support deletion (perekšlės, kiaušinių surinkimas, suvartojimas).
// A blocked delete (e.g. 400 from the API) is surfaced inside the dialog rather
// than navigating away.
export function DeleteRecordButton({
  endpoint,
  redirectTo,
  triggerLabel,
  title,
  description,
  confirmLabel = "Taip, ištrinti",
}: {
  endpoint: string;
  redirectTo: string;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(endpoint, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Nepavyko ištrinti");
      setDeleting(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="destructive" className="h-11 w-full" />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Atšaukti
          </Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Trinama..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
