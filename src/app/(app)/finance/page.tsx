import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ShoppingCart, Receipt, BarChart3, ChevronRight } from "lucide-react";

const LINKS = [
  { href: "/eggs/sales", label: "Kiaušinių pardavimai", icon: ShoppingCart },
  { href: "/expenses", label: "Išlaidos", icon: Receipt },
  { href: "/eggs/reports", label: "Kiaušinių ataskaita", icon: BarChart3 },
  { href: "/losses/reports", label: "Nuostolių ataskaita", icon: BarChart3 },
  { href: "/expenses/reports", label: "Išlaidų ataskaita", icon: BarChart3 },
];

export default function FinanceHubPage() {
  return (
    <div>
      <PageHeader title="Finansai" />
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
