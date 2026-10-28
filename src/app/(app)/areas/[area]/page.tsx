import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AREA_RECORD_LINKS, isAreaSlug } from "@/lib/v2-navigation";

// An area's Apžvalga tab. Until the area overview stories (#187–#190) add
// stats and the "Naujas" sheet, it lists the V1 screens of the area — each has
// its own add button, so records stay reachable without the old "+" sheet.
export default async function AreaOverviewPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!isAreaSlug(area)) notFound();

  return (
    <div className="flex flex-col gap-3 px-4">
      <h2 className="text-sm font-medium text-muted-foreground">Įrašai</h2>
      {AREA_RECORD_LINKS[area].map((link) => (
        <Link key={link.href} href={link.href}>
          <Card className="flex flex-row items-center gap-3 p-4">
            <span className="flex-1 font-medium">{link.label}</span>
            <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
          </Card>
        </Link>
      ))}
    </div>
  );
}
