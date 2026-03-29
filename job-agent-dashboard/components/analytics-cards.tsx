import type { Analytics } from "@/lib/api";

export function AnalyticsCards({ analytics }: { analytics: Analytics | null }) {
  const items = [
    {
      label: "Total Jobs",
      value: analytics?.total_jobs ?? "--",
      note: "Stored intelligence base",
    },
    {
      label: "Top Jobs",
      value: analytics?.top_jobs_count ?? "--",
      note: "Score 70 and above",
    },
    {
      label: "Applications Sent",
      value: analytics?.applications_sent ?? "--",
      note: "Ready or applied statuses",
    },
    {
      label: "Response Rate",
      value: analytics ? `${analytics.response_rate}%` : "--",
      note: "Manual outcome tracking",
    },
  ];

  return (
    <div className="grid cards">
      {items.map((item) => (
        <div className="card" key={item.label}>
          <div className="metric-label">{item.label}</div>
          <p className="metric-value">{item.value}</p>
          <p className="metric-note">{item.note}</p>
        </div>
      ))}
    </div>
  );
}
