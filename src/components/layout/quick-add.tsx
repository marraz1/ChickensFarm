"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Plus,
  Users,
  Egg,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Heart,
  Utensils,
  Bird,
  PiggyBank,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type QuickAction = {
  href: string;
  label: string;
  icon: typeof Plus;
};

const BIRDS_ACTIONS: QuickAction[] = [
  { href: "/bird-groups/new", label: "Nauja paukščių grupė", icon: Users },
  { href: "/birds/purchases/new", label: "Pirkti paukščių", icon: PiggyBank },
  { href: "/birds/sales/new", label: "Parduoti paukščių", icon: Bird },
  { href: "/eggs/collections/new", label: "Surinkti kiaušinius", icon: Egg },
  { href: "/eggs/consumptions/new", label: "Suvartoti kiaušinius", icon: Utensils },
  { href: "/losses/new", label: "Registruoti nuostolį", icon: AlertTriangle },
  { href: "/mother-hens/new", label: "Nauja perekšlė", icon: Heart },
];

const FINANCE_ACTIONS: QuickAction[] = [
  { href: "/eggs/sales/new", label: "Naujas kiaušinių pardavimas", icon: ShoppingCart },
  { href: "/birds/sales/new", label: "Parduoti paukščių", icon: Bird },
  { href: "/birds/purchases/new", label: "Pirkti paukščių", icon: PiggyBank },
  { href: "/expenses/new", label: "Nauja išlaida", icon: Receipt },
];

const INCUBATION_ACTIONS: QuickAction[] = [
  { href: "/incubation/new", label: "Naujas perinimo ciklas", icon: Egg },
];

// Deduped by href: the bird buy/sell actions belong to both groups, and the
// list is keyed by href.
const DEFAULT_ACTIONS: QuickAction[] = [
  ...new Map([...BIRDS_ACTIONS, ...FINANCE_ACTIONS].map((a) => [a.href, a])).values(),
];

function actionsForPath(pathname: string): QuickAction[] {
  if (pathname.startsWith("/birds") || pathname.startsWith("/mother-hens")) return BIRDS_ACTIONS;
  if (pathname.startsWith("/finance")) return FINANCE_ACTIONS;
  if (pathname.startsWith("/incubation")) return INCUBATION_ACTIONS;
  return DEFAULT_ACTIONS;
}

/**
 * The "add a record" control and its quick-action sheet. Rendered as the middle
 * item of BottomTabBar rather than floating above it: it sits on the same row as
 * the tabs and so covers no content. The filled circle keeps it reading as the
 * bar's primary action instead of a fifth tab.
 */
export function QuickAddButton() {
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
        aria-haspopup="dialog"
        aria-expanded={open}
        // Matches TabLink's metrics so the row's five items stay aligned.
        className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus size={18} aria-hidden />
        </span>
        <span className="text-[11px]">Pridėti</span>
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
