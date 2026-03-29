"use client";

import { useEffect, useState } from "react";

import { JobsTable } from "@/components/jobs-table";
import { type Job, getAllJobs } from "@/lib/api";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [threshold, setThreshold] = useState(70);
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      const data = await getAllJobs({
        page,
        pageSize: 20,
        minScore: threshold,
        source,
      });
      setJobs(data.items);
      setTotal(data.total);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [threshold, source, page]);

  return (
    <section className="panel">
      <div className="section-row">
        <div>
          <h2 className="section-title">Jobs</h2>
          <p className="subtitle">{total} jobs matched the current filters.</p>
        </div>
        <div className="filters">
          <div className="field">
            <label htmlFor="jobs-threshold">Score Threshold</label>
            <input
              id="jobs-threshold"
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={(event) => {
                setPage(1);
                setThreshold(Number(event.target.value));
              }}
            />
            <span className="range-value">{threshold}</span>
          </div>
          <div className="field">
            <label htmlFor="jobs-source">Source</label>
            <select
              id="jobs-source"
              value={source}
              onChange={(event) => {
                setPage(1);
                setSource(event.target.value);
              }}
            >
              <option value="">All</option>
              <option value="lever">Lever</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="workable">Workable</option>
              <option value="ashby">Ashby</option>
              <option value="RemoteOK">RemoteOK</option>
              <option value="WeWorkRemotely">WeWorkRemotely</option>
            </select>
          </div>
          <div className="button-row">
            <button className="button secondary" onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Previous
            </button>
            <button className="button secondary" onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <div className="notice notice-error">
          <h3 className="notice-title">Could not load jobs</h3>
          <p className="notice-copy">{error}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="notice">
          <h3 className="notice-title">Refreshing jobs</h3>
          <p className="notice-copy">Loading the current ranked list from the backend.</p>
        </div>
      ) : null}
      <JobsTable jobs={jobs} onApplied={refresh} />
    </section>
  );
}
