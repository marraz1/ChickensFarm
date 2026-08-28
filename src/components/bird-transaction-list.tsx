import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDateLT, formatEUR } from "@/lib/format";
import type { BirdTransactionType } from "@/generated/prisma/client";

/**
 * The per-direction wording and routing for bird purchases and sales. Both
 * directions render the same list and form, so everything that differs between
 * them lives here rather than being duplicated across six page files.
 */
export const birdTransactionPages = {
  SALE: {
    basePath: "/birds/sales",
    listTitle: "Paukščių pardavimai",
    newTitle: "Naujas paukščių pardavimas",
    editTitle: "Koreguoti pardavimą",
    emptyText: "Dar nėra paukščių pardavimų.",
    deleteTriggerLabel: "Ištrinti pardavimą",
    deleteTitle: "Ištrinti pardavimo įrašą?",
    deleteDescription:
      "Šis paukščių pardavimo įrašas bus visam laikui ištrintas, o susietos grupės kiekis atstatytas. Šio veiksmo atšaukti nepavyks.",
  },
  PURCHASE: {
    basePath: "/birds/purchases",
    listTitle: "Paukščių pirkimai",
    newTitle: "Naujas paukščių pirkimas",
    editTitle: "Koreguoti pirkimą",
    emptyText: "Dar nėra paukščių pirkimų.",
    deleteTriggerLabel: "Ištrinti pirkimą",
    deleteTitle: "Ištrinti pirkimo įrašą?",
    deleteDescription:
      "Šis paukščių pirkimo įrašas bus visam laikui ištrintas, o susietos grupės kiekis atstatytas. Šio veiksmo atšaukti nepavyks.",
  },
} as const satisfies Record<BirdTransactionType, Record<string, string>>;

type BirdTransactionRow = {
  id: string;
  transactionDate: Date;
  quantity: number;
  unitPrice: unknown;
  totalAmount: unknown;
  counterparty: string | null;
  birdGroup: { breed: { name: string } } | null;
};

export function BirdTransactionList({
  transactions,
  type,
}: {
  transactions: BirdTransactionRow[];
  type: BirdTransactionType;
}) {
  const page = birdTransactionPages[type];

  return (
    <div className="flex flex-col gap-3 px-4">
      {transactions.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{page.emptyText}</p>
      )}
      {transactions.map((transaction) => (
        <Link key={transaction.id} href={`${page.basePath}/${transaction.id}/edit`}>
          <Card className="flex flex-row items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium">{formatDateLT(transaction.transactionDate)}</p>
              <p className="truncate text-sm text-muted-foreground">
                {transaction.quantity} vnt. · {formatEUR(Number(transaction.unitPrice))} už vnt.
                {transaction.birdGroup ? ` · ${transaction.birdGroup.breed.name}` : ""}
                {transaction.counterparty ? ` · ${transaction.counterparty}` : ""}
              </p>
            </div>
            {/* Sales are money in (green, like egg sales); purchases are money
                out, left neutral to match the expenses list. */}
            <p
              className={`shrink-0 text-lg font-semibold ${
                type === "SALE" ? "text-emerald-600" : ""
              }`}
            >
              {formatEUR(Number(transaction.totalAmount))}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
