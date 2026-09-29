import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { FeedbackForm } from "@/components/forms/feedback-form";

export default async function FeedbackPage() {
  await requireUser();

  return (
    <div>
      <PageHeader title="Siųsti atsiliepimą" backHref="/profile" />
      <div className="flex flex-col gap-4 px-4">
        <p className="text-sm text-muted-foreground">
          Pastebėjote klaidą, kažkas nepatogu ar turite idėją? Parašykite — kiekvieną atsiliepimą
          perskaitome.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
