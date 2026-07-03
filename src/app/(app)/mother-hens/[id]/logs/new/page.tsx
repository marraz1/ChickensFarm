import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getMotherHenWithLogs } from "@/lib/services/mother-hens";
import { PageHeader } from "@/components/layout/page-header";
import { MotherHenLogForm } from "@/components/forms/mother-hen-log-form";

export default async function NewMotherHenLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { farm } = await requireActiveFarm();
  const hen = await getMotherHenWithLogs(farm.id, id);
  if (!hen) notFound();

  return (
    <div>
      <PageHeader title="Naujas įrašas" backHref={`/mother-hens/${hen.id}`} />
      <div className="px-4">
        <MotherHenLogForm motherHenId={hen.id} />
      </div>
    </div>
  );
}
