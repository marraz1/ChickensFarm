"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Users, Egg, AlertTriangle, ShoppingCart, Receipt, Heart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type QuickAction = {
  href: string;
  label: string;
  icon: typeof Plus;
};

const BIRDS_ACTIONS: QuickAction[] = [
  { href: "/bird-groups/new", label: "Nauja paukščių grupė", icon: Users },
  { href: "/eggs/collections/new", label: "Surinkti kiaušinius", icon: Egg },
  { href: "/losses/new", label: "Registruoti nuostolį", icon: AlertTriangle },
  { href: "/mother-hens/new", label: "Nauja perekšlė", icon: Heart },
];

const FINANCE_ACTIONS: QuickAction[] = [
  { href: "/eggs/sales/new", label: "Naujas pardavimas", icon: ShoppingCart },
  { href: "/expenses/new", label: "Nauja išlaida", icon: Receipt },
];

const INCUBATION_ACTIONS: QuickAction[] = [
  { href: "/incubation/new", label: "Naujas perinimo ciklas", icon: Egg },
];

const DEFAULT_ACTIONS: QuickAction[] = [...BIRDS_ACTIONS, ...FINANCE_ACTIONS];

function actionsForPath(pathname: string): QuickAction[] {
  if (pathname.startsWith("/birds") || pathname.startsWith("/mother-hens")) return BIRDS_ACTIONS;
  if (pathname.startsWith("/finance")) return FINANCE_ACTIONS;
  if (pathname.startsWith("/incubation")) return INCUBATION_ACTIONS;
  return DEFAULT_ACTIONS;
}

export function Fab() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const actions = actionsForPath(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pridėti įrašą"
        className={cn(
          "fixed bottom-14 left-1/2 z-50 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        )}
      >
        <Plus size={24} aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Pridėti įrašą</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4">
            {actions.map((action) => (
              <button
                key={action.href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(action.href);
                }}
                className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-accent"
              >
                <action.icon size={20} className="text-muted-foreground" aria-hidden />
                <span className="text-sm">{action.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
