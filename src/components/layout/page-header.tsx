import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-4">
      <div className="flex items-center gap-1">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Grįžti"
            className="flex h-11 w-11 items-center justify-center -ml-2 text-muted-foreground"
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
        )}
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {action}
    </div>
  );
}
