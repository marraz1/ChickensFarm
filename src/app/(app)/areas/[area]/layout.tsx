import { notFound } from "next/navigation";
import { AreaTabs } from "@/components/layout/area-tabs";
import { farmAreaLabels } from "@/lib/labels";
import { requireActiveFarm } from "@/lib/session";
import { AREA_SLUGS, isAreaSlug } from "@/lib/v2-navigation";

// Exactly the four areas; any other /areas/<slug> is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(AREA_SLUGS).map((area) => ({ area }));
}

export default async function AreaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  if (!isAreaSlug(area)) notFound();
  await requireActiveFarm();

  return (
    <div>
      <div className="px-4 py-4">
        <h1 className="text-lg font-semibold">{farmAreaLabels[AREA_SLUGS[area]]}</h1>
      </div>
      <AreaTabs area={area} />
      {children}
    </div>
  );
}
