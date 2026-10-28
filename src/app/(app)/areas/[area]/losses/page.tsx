import Link from "next/link";
import { Plus } from "lucide-react";
import { AreaTabPending } from "@/components/v2/area-tab-pending";

// The area's Nuostoliai tab. "Nuostolis" opens the area loss form (#195); the
// list itself comes with #196, until then the body links to the farm-wide one.
// The area layout has already turned an unknown slug into a 404.
export default async function AreaLossesPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end px-4">
        <Link
          href={`/losses/new?area=${area}`}
          className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} aria-hidden /> Nuostolis
        </Link>
      </div>
      <AreaTabPending tab="losses" />
    </div>
  );
}
