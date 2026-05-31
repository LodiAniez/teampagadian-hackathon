import { View, Text } from "react-native";
import { Card } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPhp } from "@/lib/format";
import type { MonthOverMonthDelta } from "../../utils/earnings-delta";

type Props = {
  thisMonthPhp: number | undefined;
  delta: MonthOverMonthDelta | null;
  isLoading: boolean;
};

const DELTA_STYLE = {
  up: { className: "text-brand-700", arrow: "▲" },
  down: { className: "text-red-600", arrow: "▼" },
  flat: { className: "text-gray-400", arrow: "▬" },
} as const;

/**
 * Hero card: total earned this month with a month-over-month delta. The delta
 * is derived from the by-month series (the summary has no last-month field).
 */
export function EarningsHeroCard({ thisMonthPhp, delta, isLoading }: Props) {
  return (
    <Card className="gap-2">
      <Text className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Earned this month
      </Text>
      {isLoading || thisMonthPhp === undefined ? (
        <Skeleton className="h-10 w-48" />
      ) : (
        <Text className="text-4xl font-bold text-gray-900">{formatPhp(thisMonthPhp)}</Text>
      )}
      {delta ? <DeltaLabel delta={delta} /> : null}
    </Card>
  );
}

function DeltaLabel({ delta }: { delta: MonthOverMonthDelta }) {
  const style = DELTA_STYLE[delta.direction];
  const magnitude =
    delta.deltaPct !== null ? `${Math.abs(delta.deltaPct)}%` : formatPhp(Math.abs(delta.deltaPhp));

  return (
    <Text className={`text-sm font-medium ${style.className}`}>
      {style.arrow} {magnitude} vs last month
    </Text>
  );
}
