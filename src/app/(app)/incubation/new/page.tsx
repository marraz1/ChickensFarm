import { requireActiveFarm } from "@/lib/session";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { listHensFreeToSit } from "@/lib/services/mother-hens";
import { PageHeader } from "@/components/layout/page-header";
import { IncubationCycleForm } from "@/components/forms/incubation-cycle-form";

export default async function NewIncubationCyclePage({
  searchParams,
}: {
  searchParams: Promise<{ motherHenId?: string | string[] }>;
}) {
  const [{ motherHenId }, { farm }] = await Promise.all([searchParams, requireActiveFarm()]);
  const [groups, hens] = await Promise.all([listBirdGroups(farm.id), listHensFreeToSit(farm.id)]);
  // "Pradėti perėjimą" on a hen's page preselects her (#188), if she can sit.
  const preset =
    typeof motherHenId === "string" && hens.some((h) => h.id === motherHenId) ? motherHenId : "";

  return (
    <div>
      <PageHeader title="Naujas perinimo ciklas" backHref="/incubation" />
      <div className="px-4">
        <IncubationCycleForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          motherHens={hens.map((h) => ({ id: h.id, label: h.name }))}
          defaultMotherHenId={preset}
        />
      </div>
    </div>
  );
}
