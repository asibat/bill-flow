import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  formatAmount,
  formatDueDate,
  getBillStatusColor,
  getBillStatusLabel,
} from "@/lib/utils";
import { aggregateByCurrency } from "@/lib/currency";
import {
  getMonthlySpending,
  getTopVendors,
  getSpendingTrend,
} from "@/lib/analytics";
import { isFeatureEnabled } from "@/lib/features";
import { getVisibleReminders } from "@/lib/reminders/view";
import { differenceInDays, format } from "date-fns";
import Link from "next/link";
import type { Bill } from "@/types";
import RemindersList from "./_components/RemindersList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", user!.id)
    .order("due_date", { ascending: true })
    .limit(200);

  // Fetch upcoming reminders
  const { data: reminders } = await supabase
    .from("reminders")
    .select(
      "id, bill_id, remind_at, kind, sent_at, dismissed_at, bills!inner(payee_name, amount, currency, due_date, paid_at, status)",
    )
    .eq("user_id", user!.id)
    .is("dismissed_at", null)
    .order("remind_at", { ascending: true })
    .limit(10);

  const visibleReminders = getVisibleReminders(reminders ?? []);

  // Fetch salary day for countdown
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("salary_day")
    .eq("user_id", user!.id)
    .single();

  const allBills: Bill[] = bills || [];
  const unpaid = allBills.filter(
    (b) => !["confirmed", "payment_sent"].includes(b.status),
  );
  const paid = allBills.filter((b) =>
    ["confirmed", "payment_sent"].includes(b.status),
  );
  const overdue = unpaid.filter(
    (b) => differenceInDays(new Date(b.due_date), new Date()) < 0,
  );
  const dueThisWeek = unpaid.filter((b) => {
    const d = differenceInDays(new Date(b.due_date), new Date());
    return d >= 0 && d <= 7;
  });
  const needsReview = allBills.filter((b) => b.needs_review);
  const { breakdown: unpaidBreakdown, totalInEur: totalUnpaidEur } =
    aggregateByCurrency(
      unpaid.map((b) => ({ amount: b.amount, currency: b.currency })),
    );

  // Analytics (feature-flagged)
  const showAnalytics = isFeatureEnabled("DASHBOARD_ANALYTICS");
  const monthlySpending = showAnalytics ? getMonthlySpending(allBills, 6) : [];
  const topVendors = showAnalytics ? getTopVendors(allBills, 5) : [];
  const trend = showAnalytics ? getSpendingTrend(monthlySpending) : null;
  const totalPaid = paid.reduce((s, b) => s + b.amount, 0);
  const focusCount = overdue.length + dueThisWeek.length + needsReview.length;
  const nextDueBill = unpaid[0] ?? null;

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                Control Center
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Keep the urgent bills moving.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                BillFlow keeps today’s obligations, payment follow-ups, and
                upcoming due dates in one place so you can act fast without
                losing the bigger picture.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/bills/new" className="btn-primary">
                  Add Bill
                </Link>
                <Link href="/bills/batch" className="btn-secondary">
                  Start Payment Session
                </Link>
                <Link href="/bills" className="btn-secondary">
                  Review All Bills
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <FocusCard
                eyebrow="Immediate focus"
                title={
                  overdue.length > 0
                    ? `${overdue.length} overdue bill${overdue.length === 1 ? "" : "s"}`
                    : dueThisWeek.length > 0
                      ? `${dueThisWeek.length} bill${dueThisWeek.length === 1 ? "" : "s"} due this week`
                      : "No urgent bills"
                }
                detail={
                  overdue.length > 0
                    ? `${formatAmount(overdue.reduce((s, b) => s + b.amount, 0))} needs attention now`
                    : nextDueBill
                      ? `${nextDueBill.payee_name} is next due ${format(new Date(nextDueBill.due_date), "d MMM")}`
                      : "You are caught up for now"
                }
                tone={
                  overdue.length > 0
                    ? "red"
                    : dueThisWeek.length > 0
                      ? "amber"
                      : "green"
                }
              />
              <FocusCard
                eyebrow="Review queue"
                title={
                  needsReview.length > 0
                    ? `${needsReview.length} bill${needsReview.length === 1 ? "" : "s"} need review`
                    : "Review queue is clear"
                }
                detail={
                  needsReview.length > 0
                    ? "Open the flagged bills and confirm the extracted details."
                    : "New uploads and forwards are being processed cleanly."
                }
                tone={needsReview.length > 0 ? "amber" : "blue"}
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            label="Total Outstanding"
            value={
              unpaidBreakdown.length <= 1
                ? formatAmount(totalUnpaidEur)
                : `${formatAmount(totalUnpaidEur)} equiv.`
            }
            sub={
              unpaidBreakdown.length > 1
                ? unpaidBreakdown.map((b) => b.formatted).join(" + ")
                : `${unpaid.length} open bills`
            }
            color="blue"
          />
          <StatCard
            label="Action Items"
            value={String(focusCount)}
            sub={
              focusCount > 0
                ? "Urgent or review work waiting"
                : "Nothing blocking right now"
            }
            color={focusCount > 0 ? "amber" : "green"}
          />
          <StatCard
            label="Due This Week"
            value={String(dueThisWeek.length)}
            sub={
              dueThisWeek.length
                ? formatAmount(dueThisWeek.reduce((s, b) => s + b.amount, 0))
                : "Nothing urgent"
            }
            color={dueThisWeek.length ? "amber" : "green"}
          />
          <StatCard
            label="Paid"
            value={String(paid.length)}
            sub={paid.length ? formatAmount(totalPaid) : "No payments yet"}
            color="green"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="min-w-0">
                <RemindersList
                  reminders={visibleReminders}
                  salaryDay={userSettings?.salary_day ?? null}
                />
              </div>
              {userSettings?.salary_day && (
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Next Payday
                  </h2>
                  <SalaryCountdown
                    salaryDay={userSettings.salary_day}
                    totalDue={totalUnpaidEur}
                  />
                  <SalarySplit
                    salaryDay={userSettings.salary_day}
                    bills={unpaid}
                  />
                </div>
              )}
            </div>

            {trend && (
              <div className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Monthly Spending
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      A quick view of how your recent bill volume is moving.
                    </p>
                  </div>
                  <TrendBadge trend={trend} />
                </div>
                <div className="flex items-end gap-2 h-36">
                  {monthlySpending.map((m) => {
                    const maxTotal = Math.max(
                      ...monthlySpending.map((ms) => ms.total),
                      1,
                    );
                    const height =
                      m.total > 0 ? Math.max((m.total / maxTotal) * 100, 6) : 6;
                    return (
                      <div
                        key={m.month}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <span className="text-[11px] text-gray-500">
                          {m.total > 0 ? formatAmount(m.total) : ""}
                        </span>
                        <div className="relative w-full flex-1 rounded-2xl bg-slate-100 p-1">
                          <div
                            className="absolute inset-x-1 bottom-1 rounded-xl bg-gradient-to-t from-brand-700 to-brand-400 transition-all"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {m.label.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {topVendors.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
                  Top Vendors
                </h2>
                <p className="mb-4 text-sm text-gray-500">
                  The payees taking the biggest share of your bill spend.
                </p>
                <div className="space-y-3">
                  {topVendors.map((v) => (
                    <div
                      key={v.payee_name}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {v.payee_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {v.count} bills
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {formatAmount(v.total, v.currency)}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${v.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <QueueCard
              title="Outstanding Queue"
              empty="No unpaid bills right now."
              items={
                overdue.length > 0
                  ? overdue
                  : dueThisWeek.length > 0
                    ? dueThisWeek
                    : unpaid
                        .filter(
                          (b) =>
                            differenceInDays(new Date(b.due_date), new Date()) >
                            7,
                        )
                        .slice(0, 5)
              }
              accent={
                overdue.length > 0
                  ? "red"
                  : dueThisWeek.length > 0
                    ? "amber"
                    : "blue"
              }
            />
          </div>
        </div>

        {needsReview.length > 0 && (
          <div>
            <SectionHeader label="Needs Review" color="amber" />
            <div className="space-y-2">
              {needsReview.map((bill) => (
                <BillRow key={bill.id} bill={bill} highlight />
              ))}
            </div>
          </div>
        )}

        {paid.length > 0 && (
          <div>
            <SectionHeader label="Recently Paid" color="green" />
            <div className="space-y-2">
              {paid.slice(0, 5).map((bill) => (
                <BillRow key={bill.id} bill={bill} />
              ))}
              {paid.length > 5 && (
                <Link
                  href="/bills?status=paid"
                  className="block text-sm text-brand-600 hover:underline pl-1 pt-1"
                >
                  View all {paid.length} paid bills
                </Link>
              )}
            </div>
          </div>
        )}

        {allBills.length === 0 && (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📬</div>
            <h3 className="text-lg font-semibold mb-2">No bills yet</h3>
            <p className="text-gray-500 mb-4 text-sm">
              Forward a Doccle notification to your inbox address, or add a bill
              manually.
            </p>
            <Link href="/bills/new" className="btn-primary">
              Add your first bill
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  const dots: Record<string, string> = {
    red: "text-red-500",
    amber: "text-amber-500",
    blue: "text-brand-500",
    green: "text-green-500",
  };
  const textColors: Record<string, string> = {
    red: "text-red-700",
    amber: "text-amber-700",
    blue: "text-gray-700",
    green: "text-green-700",
  };
  return (
    <h2
      className={`text-base font-semibold ${textColors[color] || "text-gray-700"} mb-3 flex items-center gap-2`}
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full bg-current ${dots[color]}`}
      />
      {label}
    </h2>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "border-brand-200 bg-gradient-to-br from-brand-50 to-white",
    red: "border-red-200 bg-gradient-to-br from-red-50 to-white",
    green: "border-green-200 bg-gradient-to-br from-green-50 to-white",
    amber: "border-amber-200 bg-gradient-to-br from-amber-50 to-white",
  };
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${colors[color] || colors.blue}`}
    >
      <p className="text-[11px] text-gray-500 font-medium uppercase tracking-[0.18em]">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-2 min-h-[2rem]">{sub}</p>
    </div>
  );
}

function FocusCard({
  eyebrow,
  title,
  detail,
  tone,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "red" | "amber" | "green" | "blue";
}) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-green-200 bg-green-50 text-green-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {eyebrow}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{title}</p>
      <p className="mt-2 text-sm opacity-80">{detail}</p>
    </div>
  );
}

function TrendBadge({
  trend,
}: {
  trend: NonNullable<ReturnType<typeof getSpendingTrend>>;
}) {
  if (trend.direction === "up") {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
        +{trend.percentageChange}% vs last month
      </span>
    );
  }
  if (trend.direction === "down") {
    return (
      <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-600">
        -{trend.percentageChange}% vs last month
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
      Stable vs last month
    </span>
  );
}

function SalaryCountdown({
  salaryDay,
  totalDue,
}: {
  salaryDay: number;
  totalDue: number;
}) {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), salaryDay);
  const nextPayday =
    thisMonth > today
      ? thisMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, salaryDay);
  const daysUntil = differenceInDays(nextPayday, today);

  return (
    <div className="text-center">
      <p className="text-4xl font-bold text-brand-600">{daysUntil}</p>
      <p className="text-sm text-gray-500 mt-1">
        day{daysUntil !== 1 ? "s" : ""} until payday
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {format(nextPayday, "d MMMM")}
      </p>
      {totalDue > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {formatAmount(totalDue)} due before then
        </p>
      )}
    </div>
  );
}

function SalarySplit({
  salaryDay,
  bills,
}: {
  salaryDay: number;
  bills: Bill[];
}) {
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), salaryDay);
  const nextPayday =
    thisMonth > today
      ? thisMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, salaryDay);

  const beforePayday = bills.filter((b) => new Date(b.due_date) < nextPayday);
  const afterPayday = bills.filter((b) => new Date(b.due_date) >= nextPayday);
  const beforeTotal = beforePayday.reduce((s, b) => s + b.amount, 0);
  const afterTotal = afterPayday.reduce((s, b) => s + b.amount, 0);

  if (bills.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      {beforePayday.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-red-600">Pay before salary</span>
            <span className="text-gray-500">{formatAmount(beforeTotal)}</span>
          </div>
          <div className="space-y-1">
            {beforePayday.slice(0, 4).map((b) => (
              <Link
                key={b.id}
                href={`/bills/${b.id}`}
                className="flex justify-between text-xs text-gray-600 hover:text-gray-900"
              >
                <span className="truncate">{b.payee_name}</span>
                <span className="shrink-0 ml-2">{formatAmount(b.amount)}</span>
              </Link>
            ))}
            {beforePayday.length > 4 && (
              <span className="text-xs text-gray-400">
                +{beforePayday.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
      {afterPayday.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-green-600">
              After salary lands
            </span>
            <span className="text-gray-500">{formatAmount(afterTotal)}</span>
          </div>
          <div className="space-y-1">
            {afterPayday.slice(0, 3).map((b) => (
              <Link
                key={b.id}
                href={`/bills/${b.id}`}
                className="flex justify-between text-xs text-gray-600 hover:text-gray-900"
              >
                <span className="truncate">{b.payee_name}</span>
                <span className="shrink-0 ml-2">{formatAmount(b.amount)}</span>
              </Link>
            ))}
            {afterPayday.length > 3 && (
              <span className="text-xs text-gray-400">
                +{afterPayday.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BillRow({ bill, highlight }: { bill: Bill; highlight?: boolean }) {
  const isPaid = ["payment_sent", "confirmed"].includes(bill.status);
  return (
    <Link
      href={`/bills/${bill.id}`}
      className={`card p-4 flex items-center justify-between gap-3 hover:shadow-md transition-shadow ${highlight ? "border-amber-300 bg-amber-50/40" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isPaid ? "bg-green-50" : "bg-brand-50"}`}
        >
          {bill.source === "doccle"
            ? "🟦"
            : bill.source === "email"
              ? "📧"
              : bill.source === "upload"
                ? "📎"
                : "✏️"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900 text-sm">
            {bill.payee_name}
          </p>
          <p className="text-xs text-gray-500">
            {isPaid && bill.paid_at
              ? `Paid ${format(new Date(bill.paid_at), "d MMM yyyy")}`
              : formatDueDate(bill.due_date)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {bill.structured_comm && (
          <span
            className={`hidden md:inline-flex text-xs px-2 py-0.5 rounded-full font-mono ${bill.structured_comm_valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            {bill.structured_comm_valid ? "✓ ref" : "⚠ ref"}
          </span>
        )}
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBillStatusColor(bill.status)}`}
        >
          {getBillStatusLabel(bill.status)}
        </span>
        <span
          className={`font-semibold ${isPaid ? "text-gray-400 line-through" : "text-gray-900"}`}
        >
          {formatAmount(bill.amount, bill.currency)}
        </span>
        <span className="text-gray-400">›</span>
      </div>
    </Link>
  );
}

function QueueCard({
  title,
  empty,
  items,
  accent,
}: {
  title: string;
  empty: string;
  items: Bill[];
  accent: "red" | "amber" | "blue";
}) {
  const accentClasses = {
    red: "text-red-700",
    amber: "text-amber-700",
    blue: "text-brand-700",
  };

  return (
    <div className="card p-5">
      <h2
        className={`text-sm font-semibold uppercase tracking-wide ${accentClasses[accent]}`}
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.slice(0, 5).map((bill) => (
            <BillRow key={bill.id} bill={bill} />
          ))}
        </div>
      )}
    </div>
  );
}
