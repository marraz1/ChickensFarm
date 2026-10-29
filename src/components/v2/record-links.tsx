import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AreaRecordLink, AreaStatKey } from "@/lib/v2-navigation";

/** An area's "Įrašai" list: its V1 screens, each with its figure when given. */
export function RecordLinks({
  links,
  values = {},
}: {
  links: readonly AreaRecordLink[];
  values?: Partial<Record<AreaStatKey, string>>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href}>
            <Card className="flex min-h-11 flex-row items-center gap-3 p-4">
              <span className="flex-1 font-medium">{link.label}</span>
              {link.stat && values[link.stat] != null && (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {values[link.stat]}
                </span>
              )}
              <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
