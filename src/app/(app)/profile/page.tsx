import Link from "next/link";
import { requireUser, resolveActiveFarm } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/layout/logout-button";
import { formatDateLT } from "@/lib/format";
import { Tag, Settings, ChevronRight, User } from "lucide-react";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const [user, { activeFarm }] = await Promise.all([
    prisma.user.findUnique({ where: { id: sessionUser.id } }),
    resolveActiveFarm(sessionUser.id),
  ]);

  const displayName = user?.name?.trim() || sessionUser.name || "Naudotojas";
  const email = user?.email ?? sessionUser.email ?? "";

  const links = [
    { href: "/farms", label: "Mano ūkiai", icon: Tag },
    ...(activeFarm
      ? [{ href: `/farms/${activeFarm.id}/settings`, label: "Ūkio nustatymai", icon: Settings }]
      : []),
  ];

  return (
    <div>
      <PageHeader title="Profilis" backHref="/" />
      <div className="flex flex-col gap-6 px-4">
        <Card className="flex flex-row items-center gap-4 p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <User size={26} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{displayName}</p>
            {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
            {user?.createdAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Narys nuo {formatDateLT(user.createdAt)}
              </p>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="flex flex-row items-center gap-3 p-4">
                <link.icon size={20} className="text-muted-foreground" aria-hidden />
                <span className="flex-1 font-medium">{link.label}</span>
                <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          ))}
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}
