"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Feather, Wallet, Egg } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Pradžia", icon: Home },
  { href: "/birds", label: "Paukščiai", icon: Feather },
  { href: "/finance", label: "Finansai", icon: Wallet },
  { href: "/incubation", label: "Perinimas", icon: Egg },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}
        <div className="w-14" aria-hidden />
        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isActive(pathname, tab.href)} />
        ))}
      </div>
    </nav>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function TabLink({
  tab,
  active,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground",
        active && "text-primary"
      )}
    >
      <Icon size={20} aria-hidden />
      <span className="text-[11px]">{tab.label}</span>
    </Link>
  );
}
