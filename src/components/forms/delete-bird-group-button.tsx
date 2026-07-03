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

export function DeleteBirdGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/bird-groups/${groupId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Nepavyko ištrinti");
      setDeleting(false);
      return;
    }
    router.push("/bird-groups");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="destructive" className="h-11 w-full" />}
      >
        Ištrinti grupę
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ištrinti grupę?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Grupė ir jos istorija bus visam laikui ištrinta. Šio veiksmo atšaukti nepavyks.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Atšaukti
          </Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Trinama..." : "Taip, ištrinti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
