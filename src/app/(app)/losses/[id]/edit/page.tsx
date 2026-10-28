import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getLoss } from "@/lib/services/losses";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { LossForm } from "@/components/forms/loss-form";
import { DeleteRecordButton } from "@/components/forms/delete-record-button";
import { isAreaSlug } from "@/lib/v2-navigation";

export default async function EditLossPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ area?: string | string[] }>;
}) {
  const { id } = await params;
  const { area } = await searchParams;
  const { farm } = await requireActiveFarm();
  const [loss, groups] = await Promise.all([getLoss(farm.id, id), listBirdGroups(farm.id)]);
  if (!loss) notFound();

  // Opened from an area's Nuostoliai tab: back, save and delete return there.
  const returnPath =
    typeof area === "string" && isAreaSlug(area) ? `/areas/${area}/losses` : "/losses";

  return (
    <div>
      <PageHeader title="Koreguoti nuostolį" backHref={returnPath} />
      <div className="flex flex-col gap-6 px-4">
        <LossForm
          birdGroups={groups.map((g) => ({ id: g.id, label: g.breed.name }))}
          lossId={loss.id}
          defaultValues={{
            lossDate: loss.lossDate.toISOString().slice(0, 10),
            quantity: loss.quantity,
            reasonType: loss.reasonType,
            birdGroupId: loss.birdGroupId ?? "",
            comment: loss.comment ?? "",
          }}
          onSuccessPath={returnPath}
        />
        <DeleteRecordButton
          endpoint={`/api/losses/${loss.id}`}
          redirectTo={returnPath}
          triggerLabel="Ištrinti nuostolį"
          title="Ištrinti nuostolio įrašą?"
          description="Įrašas bus ištrintas, o grupės kiekis, perekšlė ar ciklo jauniklių skaičius bus atstatyti. Šio veiksmo atšaukti nepavyks."
        />
      </div>
    </div>
  );
}
