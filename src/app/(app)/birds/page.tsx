import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Users, Tag, Egg, AlertTriangle, Heart, Utensils, ChevronRight } from "lucide-react";

const LINKS = [
  { href: "/bird-groups", label: "Paukščių grupės", icon: Users },
  { href: "/breeds", label: "Veislės", icon: Tag },
  { href: "/mother-hens", label: "Perekšlės", icon: Heart },
  { href: "/eggs/collections", label: "Kiaušinių surinkimas", icon: Egg },
  { href: "/eggs/consumptions", label: "Suvartoti kiaušiniai", icon: Utensils },
  { href: "/losses", label: "Nuostoliai", icon: AlertTriangle },
];

export default function BirdsHubPage() {
  return (
    <div>
      <PageHeader title="Paukščiai" />
      <div className="flex flex-col gap-3 px-4">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="flex flex-row items-center gap-3 p-4">
              <link.icon size={20} className="text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">{link.label}</span>
              <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
