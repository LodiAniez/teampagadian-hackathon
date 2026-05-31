import { ScrollView, RefreshControl, View, Text } from "react-native";
import { Card } from "@/components/ui";
import { FxComparisonCard } from "@/features/fx";
import { useDashboard } from "../../hooks/use-dashboard";
import { EarningsBarChart } from "../EarningsBarChart/EarningsBarChart";
import { DashboardGreeting } from "../DashboardGreeting/DashboardGreeting";
import { EarningsHeroCard } from "../EarningsHeroCard/EarningsHeroCard";
import { RecentInvoices } from "../RecentInvoices/RecentInvoices";
import { DashboardEmptyState } from "../DashboardEmptyState/DashboardEmptyState";

// Representative amount for the savings calculator on the dashboard (the home
// screen has no single "current invoice" to key off).
const DASHBOARD_FX_DEMO_USD = 1000;

/**
 * Dashboard feature view: composes the sections, owns scroll + pull-to-refresh,
 * and falls back to the first-run empty state. All data/derivation lives in
 * `useDashboard`; the sections are pure presentational components.
 */
export function Dashboard() {
  const {
    summary,
    summaryLoading,
    monthlyDelta,
    recentInvoices,
    recentLoading,
    isEmpty,
    isRefreshing,
    refresh,
  } = useDashboard();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 p-4 pb-28"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#059669" />
      }
    >
      <DashboardGreeting
        savingsVsPaypalPhp={summary?.savingsVsPaypalPhp}
        isLoading={summaryLoading}
      />

      {isEmpty ? (
        <DashboardEmptyState />
      ) : (
        <>
          <EarningsHeroCard
            thisMonthPhp={summary?.thisMonthPhp}
            delta={monthlyDelta}
            isLoading={summaryLoading}
          />

          <View className="gap-2">
            <Text className="text-base font-semibold text-gray-900">Last 6 months</Text>
            <Card>
              <EarningsBarChart />
            </Card>
          </View>

          <RecentInvoices invoices={recentInvoices} isLoading={recentLoading} />
        </>
      )}

      <FxComparisonCard usdAmount={DASHBOARD_FX_DEMO_USD} />
    </ScrollView>
  );
}
