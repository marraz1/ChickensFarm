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

export function DeleteFarmButton({ farmId }: { farmId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/farms/${farmId}`, { method: "DELETE" });
    router.push("/farms");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="destructive" className="h-11 w-full" />}
      >
        Ištrinti ūkį
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ištrinti ūkį?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ūkis bus paslėptas ir nebebus matomas sąrašuose. Šio veiksmo negalėsite atšaukti patys.
        </p>
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
