import { notFound } from "next/navigation";
import { requireActiveFarm } from "@/lib/session";
import { getBreed } from "@/lib/services/breeds";
import { PageHeader } from "@/components/layout/page-header";
import { BreedForm } from "@/components/forms/breed-form";

export default async function EditBreedPage({
  params,
}: {
  params: Promise<{ breedId: string }>;
}) {
  const { breedId } = await params;
  const { farm } = await requireActiveFarm();
  const breed = await getBreed(farm.id, breedId);
  if (!breed) notFound();

  return (
    <div>
      <PageHeader title="Redaguoti veislę" backHref="/breeds" />
      <div className="px-4">
        <BreedForm
          breedId={breed.id}
          defaultValues={{
            name: breed.name,
            birdType: breed.birdType,
            description: breed.description ?? "",
          }}
          onSuccessPath="/breeds"
        />
      </div>
    </div>
  );
}
