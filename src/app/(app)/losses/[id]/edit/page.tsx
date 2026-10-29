import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getLoss } from "@/lib/services/losses";
import { listBirdGroups } from "@/lib/services/bird-groups";
import { PageHeader } from "@/components/layout/page-header";
import { LossForm, type LossLockedTarget } from "@/components/forms/loss-form";
import { birdGroupLabel, cycleLabel } from "@/lib/labels";
import { birdGroupAreaEnum } from "@/lib/validation/farm-areas";
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
  const loss = await getLoss(farm.id, id);
  if (!loss) notFound();
  // A group's loss can move only to another group of the same area (the
  // server refuses others), so only those are offered.
  const groupArea = birdGroupAreaEnum.safeParse(loss.birdGroupId ? loss.area : null);
  const groups = await listBirdGroups(farm.id, groupArea.success ? groupArea.data : null);

  // Opened from an area's Nuostoliai tab: back, save and delete return there.
  const returnPath =
    typeof area === "string" && isAreaSlug(area) ? `/areas/${area}/losses` : "/losses";

  // A hen's or cycle's loss changed her or the cycle's growth record, so what
  // was lost and how many are fixed (and a cycle loss's date, #195).
  const lockedTarget: LossLockedTarget | undefined = loss.motherHen
    ? { label: "Perekšlė", value: loss.motherHen.name, lockDate: false }
    : loss.incubationCycle
      ? {
          label: "Perinimo ciklas",
          value: cycleLabel(loss.incubationCycle),
          lockDate: true,
        }
      : undefined;

  return (
    <div>
      <PageHeader title="Koreguoti nuostolį" backHref={returnPath} />
      <div className="flex flex-col gap-6 px-4">
        <LossForm
          birdGroups={groups.map((g) => ({ id: g.id, label: birdGroupLabel(g) ?? g.breed.name }))}
          lossId={loss.id}
          defaultValues={{
            lossDate: loss.lossDate.toISOString().slice(0, 10),
            quantity: loss.quantity,
            reasonType: loss.reasonType,
            birdGroupId: loss.birdGroupId ?? "",
            comment: loss.comment ?? "",
          }}
          onSuccessPath={returnPath}
          lockedTarget={lockedTarget}
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
