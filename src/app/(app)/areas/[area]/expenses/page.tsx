import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { AreaTabPending } from "@/components/v2/area-tab-pending";
import { isAreaSlug } from "@/lib/v2-navigation";

// The area's Išlaidos tab. "Išlaida" opens the area expense form (#192); the
// list itself comes with #194, until then the body links to the farm-wide list.
export default async function AreaExpensesPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!isAreaSlug(area)) notFound();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end px-4">
        <Link
          href={`/expenses/new?area=${area}`}
          className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} aria-hidden /> Išlaida
        </Link>
      </div>
      <AreaTabPending tab="expenses" />
    </div>
  );
}
