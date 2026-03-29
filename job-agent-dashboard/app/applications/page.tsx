"use client";

import { useEffect, useState } from "react";

import { ApplicationsTable } from "@/components/applications-table";
import { type Application, getApplications } from "@/lib/api";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      const items = await getApplications(status);
      setApplications(items);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [status]);

  return (
    <section className="panel">
      <div className="section-row">
        <div>
          <h2 className="section-title">Applications</h2>
          <p className="subtitle">Track manual review, ready-to-submit forms, and final outcomes.</p>
        </div>
        <div className="filters">
          <div className="field">
            <label htmlFor="application-status">Status</label>
            <select id="application-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="opened">opened</option>
              <option value="partially_filled">partially_filled</option>
              <option value="ready_for_submit">ready_for_submit</option>
              <option value="manual_required">manual_required</option>
              <option value="blocked">blocked</option>
              <option value="applied">applied</option>
              <option value="rejected">rejected</option>
              <option value="interviewing">interviewing</option>
            </select>
          </div>
        </div>
      </div>
      {error ? (
        <div className="notice notice-error">
          <h3 className="notice-title">Could not load applications</h3>
          <p className="notice-copy">{error}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="notice">
          <h3 className="notice-title">Refreshing applications</h3>
          <p className="notice-copy">Loading the latest pipeline activity from the backend.</p>
        </div>
      ) : null}
      <ApplicationsTable applications={applications} onUpdated={refresh} />
    </section>
  );
}
