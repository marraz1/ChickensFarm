import { requireActiveFarm } from "@/lib/session";
import { listBreeds } from "@/lib/services/breeds";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { BirdGroupForm } from "@/components/forms/bird-group-form";
import { groupAreaFromParam, groupAreaSlug } from "@/lib/v2-navigation";

export default async function NewBirdGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  // "Nauja dedeklių grupė" / "Nauja mėsinių grupė" open this with ?area=eggs|meat (#186).
  // Perinimas is never preset: hatched groups come from finishing a hatch.
  const preset = groupAreaFromParam((await searchParams).area);
  const area = preset === "INC" ? null : preset;
  const listPath = area ? `/bird-groups?area=${groupAreaSlug(area)}` : "/bird-groups";
  const { farm } = await requireActiveFarm();
  const [breeds, groups] = await Promise.all([listBreeds(farm.id), listBirdGroups(farm.id)]);

  return (
    <div>
      <PageHeader title="Nauja paukščių grupė" backHref={listPath} />
      <div className="px-4">
        <BirdGroupForm
          breeds={breeds}
          existingGroups={groups.map((g) => ({
            id: g.id,
            breedId: g.breedId,
            sex: g.sex,
            category: g.category,
          }))}
          defaultValues={area ? { area } : undefined}
          onSuccessPath={listPath}
        />
      </div>
    </div>
  );
}
