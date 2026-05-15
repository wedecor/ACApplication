'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, IndianRupee } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@ac/ui';

import {
  useAging,
  useFinanceOverview,
  usePayoutPipeline,
  useRevenueByCity,
  useRevenueSeries,
  useTopCustomers,
} from '@/hooks/use-finance';
import { formatMinor, formatMinorCompact, formatPercent, rangeFromPreset } from '@/lib/format';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 D' },
  { id: '30d', label: '30 D' },
  { id: '90d', label: '90 D' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
  { id: 'ytd', label: 'YTD' },
] as const;
type PresetId = (typeof PRESETS)[number]['id'];

const PIE_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

export default function FinancePage() {
  const [preset, setPreset] = useState<PresetId>('30d');
  const range = useMemo(() => rangeFromPreset(preset), [preset]);

  const overview = useFinanceOverview(range);
  const series = useRevenueSeries(range);
  const top = useTopCustomers(range);
  const byCity = useRevenueByCity(range);
  const aging = useAging();
  const payouts = usePayoutPipeline();

  const seriesData = useMemo(
    () =>
      (series.data ?? []).map((r) => ({
        day: new Date(r.day).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        revenue: r.revenueMinor / 100,
        collected: r.collectedMinor / 100,
        tax: r.taxMinor / 100,
      })),
    [series.data],
  );

  const cityData = useMemo(
    () =>
      (byCity.data ?? []).slice(0, 8).map((r) => ({
        city: r.city,
        revenue: r.revenueMinor / 100,
        bookings: r.bookings,
      })),
    [byCity.data],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Revenue, collections, GST and payout health across the platform.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border bg-muted/50 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-sm px-3 py-1 text-xs font-medium transition ${
                preset === p.id
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:bg-background/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Revenue"
          value={overview.data ? formatMinor(overview.data.revenueMinor) : '—'}
          trend="up"
          icon={<IndianRupee className="size-4" />}
        />
        <KpiCard
          label="Collected"
          value={overview.data ? formatMinor(overview.data.collectedMinor) : '—'}
        />
        <KpiCard
          label="Outstanding"
          value={overview.data ? formatMinor(overview.data.outstandingMinor) : '—'}
          trend="down"
        />
        <KpiCard
          label="GST collected"
          value={overview.data ? formatMinor(overview.data.gstCollectedMinor) : '—'}
        />
        <KpiCard
          label="Refunded"
          value={overview.data ? formatMinor(overview.data.refundedMinor) : '—'}
          trend="down"
        />
        <KpiCard
          label="Payment success"
          value={overview.data ? formatPercent(overview.data.paymentSuccessRate) : '—'}
        />
      </section>

      {/* Secondary KPIs */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SubKpi label="Invoices issued" value={overview.data?.invoicesIssued?.toString() ?? '—'} />
        <SubKpi label="Invoices paid" value={overview.data?.invoicesPaid?.toString() ?? '—'} />
        <SubKpi label="Overdue invoices" value={overview.data?.invoicesOverdue?.toString() ?? '—'} />
        <SubKpi
          label="Avg invoice"
          value={overview.data ? formatMinorCompact(overview.data.averageInvoiceMinor) : '—'}
        />
        <SubKpi
          label="Pending payouts"
          value={overview.data ? formatMinor(overview.data.pendingPayoutsMinor) : '—'}
        />
        <SubKpi
          label="Active AMCs"
          value={overview.data?.activeSubscriptions?.toString() ?? '—'}
        />
        <SubKpi
          label="AMCs expiring 14d"
          value={overview.data?.expiringIn14Days?.toString() ?? '—'}
        />
        <SubKpi
          label="Refund ratio"
          value={overview.data ? formatPercent(overview.data.refundRatio) : '—'}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <CardDescription>Revenue & collections per day, in ₹.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <AreaChart data={seriesData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) =>
                      v.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                    }
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    fill="url(#revGrad)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    stroke="#22c55e"
                    fill="url(#colGrad)"
                    name="Collected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aging (outstanding)</CardTitle>
            <CardDescription>How old are unpaid invoices?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={(aging.data ?? []).map((a) => ({
                      name: a.bucket,
                      value: a.amountMinor / 100,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {(aging.data ?? []).map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) =>
                      v.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by city</CardTitle>
            <CardDescription>Top performing cities in the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer>
                <BarChart data={cityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="city" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) =>
                      v.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                    }
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>Highest billed customers in the selected window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Customer</th>
                    <th className="px-2 py-2 text-right">Invoiced</th>
                    <th className="px-2 py-2 text-right">Paid</th>
                    <th className="px-2 py-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(top.data ?? []).map((row) => (
                    <tr key={row.customerId} className="hover:bg-muted/40">
                      <td className="px-2 py-2 font-medium">{row.fullName}</td>
                      <td className="px-2 py-2 text-right">{formatMinor(row.invoicedMinor)}</td>
                      <td className="px-2 py-2 text-right text-emerald-600">
                        {formatMinor(row.paidMinor)}
                      </td>
                      <td className="px-2 py-2 text-right text-rose-600">
                        {formatMinor(row.outstandingMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Payout pipeline (last 90 days)</CardTitle>
            <CardDescription>Technician payouts by lifecycle stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <BarChart
                  data={(payouts.data ?? []).map((r) => ({
                    status: r.status,
                    total: r.totalMinor / 100,
                    count: r.count,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === 'total'
                        ? v.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                        : v
                    }
                  />
                  <Legend />
                  <Bar dataKey="total" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string;
  trend?: 'up' | 'down';
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">{value}</span>
          {trend === 'up' && <ArrowUpRight className="size-3 text-emerald-500" />}
          {trend === 'down' && <ArrowDownRight className="size-3 text-rose-500" />}
        </div>
      </CardContent>
    </Card>
  );
}

function SubKpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tracking-tight">{value}</span>
      </CardContent>
    </Card>
  );
}
