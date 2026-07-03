"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { User, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Farm = { id: string; name: string };

export function FarmSwitcher({
  farms,
  activeFarm,
}: {
  farms: Farm[];
  activeFarm: Farm;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function switchFarm(farmId: string) {
    if (farmId === activeFarm.id) return;
    setPendingId(farmId);
    startTransition(async () => {
      await fetch("/api/active-farm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId }),
      });
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex flex-col items-start text-left">
          <span className="text-xs text-muted-foreground">Ūkis</span>
          <span className="flex items-center gap-1 text-lg font-medium">
            {activeFarm.name}
            {farms.length > 1 && <ChevronDown size={16} className="text-muted-foreground" />}
          </span>
        </DropdownMenuTrigger>
        {farms.length > 1 && (
          <DropdownMenuContent align="start">
            {farms.map((farm) => (
              <DropdownMenuItem
                key={farm.id}
                disabled={pendingId === farm.id}
                onClick={() => switchFarm(farm.id)}
              >
                {farm.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/farms/new")}>
              + Naujas ūkis
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
      <button
        type="button"
        onClick={() => router.push("/profile")}
        aria-label="Profilis"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent"
      >
        <User size={18} className="text-accent-foreground" aria-hidden />
      </button>
    </div>
  );
}
