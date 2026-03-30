"use client";

import { useEffect, useState } from "react";

import { AnalyticsCards } from "@/components/analytics-cards";
import { IntakePanel } from "@/components/intake-panel";
import { JobsTable } from "@/components/jobs-table";
import { type Analytics, type Job, type Profile, getAnalytics, getProfile, getReadyToApply, getTopJobs } from "@/lib/api";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [readyJobs, setReadyJobs] = useState<Job[]>([]);
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      const [analyticsData, readyData, topData, profileData] = await Promise.all([
        getAnalytics(),
        getReadyToApply(threshold, source),
        getTopJobs(threshold),
        getProfile(),
      ]);
      setAnalytics(analyticsData);
      setReadyJobs(readyData);
      setTopJobs(topData.slice(0, 5));
      setProfile(profileData);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [threshold, source]);

  return (
    <div className="stack">
      <IntakePanel profile={profile} onProfileChange={setProfile} onRefreshComplete={refresh} />
      {error ? (
        <section className="panel notice notice-error">
          <h2 className="notice-title">Backend unreachable</h2>
          <p className="notice-copy">
            The dashboard could not load data from the API. Check `NEXT_PUBLIC_API_BASE_URL`, confirm the backend is
            awake, then refresh.
          </p>
          <p className="notice-meta">{error}</p>
        </section>
      ) : null}
      {loading ? (
        <section className="panel notice">
          <h2 className="notice-title">Loading workspace</h2>
          <p className="notice-copy">Pulling analytics, ready-to-apply jobs, and the latest ranked queue.</p>
        </section>
      ) : null}
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
