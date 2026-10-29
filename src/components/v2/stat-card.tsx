import { Card } from "@/components/ui/card";

/**
 * One figure on an area overview (#187–#190): label, big value and a short
 * line under it. A region named by its label, so tests and screen readers can
 * find it.
 */
export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <Card className="h-full gap-1 p-3" role="region" aria-label={label}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-medium tabular-nums">{value}</p>
      {detail && <p className="text-[11px] leading-tight text-muted-foreground">{detail}</p>}
    </Card>
  );
}
