import { ArrowUpRight, Calendar, IndianRupee, Wrench } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@ac/ui';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Operations overview</h1>
        <p className="text-sm text-muted-foreground">
          Live signal from the last 24 hours. Drill into any metric to triage.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Bookings today" value="--" icon={<Calendar className="size-4" aria-hidden />} />
        <Metric label="Technicians active" value="--" icon={<Wrench className="size-4" aria-hidden />} />
        <Metric label="Revenue (today)" value="--" icon={<IndianRupee className="size-4" aria-hidden />} />
        <Metric label="SLA breaches" value="--" icon={<ArrowUpRight className="size-4" aria-hidden />} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Live dispatch feed</CardTitle>
          <CardDescription>Real-time events from the field.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No events yet"
            description="The realtime feed will populate once technician and booking events start streaming."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}
