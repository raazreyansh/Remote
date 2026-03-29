"use client";

import { useEffect, useState } from "react";

import { AnalyticsCards } from "@/components/analytics-cards";
import { JobsTable } from "@/components/jobs-table";
import { type Analytics, type Job, getAnalytics, getReadyToApply, getTopJobs } from "@/lib/api";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [readyJobs, setReadyJobs] = useState<Job[]>([]);
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [threshold, setThreshold] = useState(70);
  const [source, setSource] = useState("");

  async function refresh() {
    const [analyticsData, readyData, topData] = await Promise.all([
      getAnalytics(),
      getReadyToApply(threshold, source),
      getTopJobs(threshold),
    ]);
    setAnalytics(analyticsData);
    setReadyJobs(readyData);
    setTopJobs(topData.slice(0, 5));
  }

  useEffect(() => {
    void refresh();
  }, [threshold, source]);

  return (
    <div className="stack">
      <AnalyticsCards analytics={analytics} />
      <div className="hero">
        <section className="panel">
          <div className="section-row">
            <div>
              <h2 className="section-title">Ready To Apply</h2>
              <p className="subtitle">
                Daily action feed: direct ATS jobs, high score, not already submitted.
              </p>
            </div>
            <div className="filters">
              <div className="field">
                <label htmlFor="threshold">Score Threshold</label>
                <input
                  id="threshold"
                  type="range"
                  min="50"
                  max="100"
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                />
                <span className="range-value">{threshold}</span>
              </div>
              <div className="field">
                <label htmlFor="source">ATS Source</label>
                <select id="source" value={source} onChange={(event) => setSource(event.target.value)}>
                  <option value="">All</option>
                  <option value="lever">Lever</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="workable">Workable</option>
                  <option value="ashby">Ashby</option>
                </select>
              </div>
            </div>
          </div>
          <JobsTable jobs={readyJobs} onApplied={refresh} />
        </section>
        <section className="panel">
          <h2 className="section-title">Top Ranked Snapshot</h2>
          <p className="subtitle">High-scoring jobs across the current pipeline.</p>
          <JobsTable jobs={topJobs} showApply={false} />
        </section>
      </div>
    </div>
  );
}
