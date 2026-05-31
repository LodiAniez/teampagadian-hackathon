/**
 * A dashboard is "empty" (brand-new user) when there's nothing to show: no
 * lifetime earnings and no invoices yet. Drives the first-run empty state.
 */
export function isDashboardEmpty(args: {
  totalEarnedPhp: number;
  recentInvoiceCount: number;
}): boolean {
  return args.totalEarnedPhp <= 0 && args.recentInvoiceCount === 0;
}
