"use client";

import { useEffect, useState } from "react";

import { ApplicationsTable } from "@/components/applications-table";
import { type Application, getApplications } from "@/lib/api";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState("");

  async function refresh() {
    const items = await getApplications(status);
    setApplications(items);
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
      <ApplicationsTable applications={applications} onUpdated={refresh} />
    </section>
  );
}
