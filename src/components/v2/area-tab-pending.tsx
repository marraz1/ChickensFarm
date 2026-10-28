import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AREA_TAB_FALLBACK } from "@/lib/v2-navigation";

/**
 * Body of an area tab whose V2 screen is not built yet (Išlaidos #194,
 * Nuostoliai #196, Finansai #198): says so, and links to the farm-wide V1
 * screen that has the data meanwhile.
 */
export function AreaTabPending({ tab }: { tab: keyof typeof AREA_TAB_FALLBACK }) {
  const fallback = AREA_TAB_FALLBACK[tab];
  return (
    <div className="flex flex-col gap-3 px-4">
      <p className="text-sm text-muted-foreground">Ši skiltis dar kuriama V2 beta versijoje.</p>
      <Link href={fallback.href}>
        <Card className="flex flex-row items-center gap-3 p-4">
          <span className="flex-1 font-medium">{fallback.label}</span>
          <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
        </Card>
      </Link>
    </div>
  );
}
