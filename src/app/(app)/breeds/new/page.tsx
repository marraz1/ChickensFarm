import { requireActiveFarm } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { BreedForm } from "@/components/forms/breed-form";

export default async function NewBreedPage() {
  await requireActiveFarm();

  return (
    <div>
      <PageHeader title="Nauja veislė" backHref="/breeds" />
      <div className="px-4">
        <BreedForm onSuccessPath="/breeds" />
      </div>
    </div>
  );
}
