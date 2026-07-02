import { PageHeader } from "@/components/layout/page-header";
import { Egg } from "lucide-react";

export default function IncubationPage() {
  return (
    <div>
      <PageHeader title="Perinimas" />
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center text-muted-foreground">
        <Egg size={40} aria-hidden />
        <p className="font-medium text-foreground">Perinimo modulis netrukus</p>
        <p className="text-sm">
          Inkubatoriaus ciklų sekimas bus pasiekiamas kitame etape.
        </p>
      </div>
    </div>
  );
}
