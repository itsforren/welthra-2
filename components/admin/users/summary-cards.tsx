import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminUsersSummaryCard } from "@/hooks/use-admin-users";

export function AdminUsersSummaryCards({
  cards,
}: {
  cards: AdminUsersSummaryCard[];
}) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card className="bg-card/60 backdrop-blur" key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <span className="font-semibold text-3xl tracking-tight">
              {card.value}
            </span>
            <span className="text-muted-foreground text-sm">{card.helper}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
