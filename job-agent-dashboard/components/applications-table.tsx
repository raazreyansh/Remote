"use client";

import { useState } from "react";

import { type Application, updateApplication } from "@/lib/api";

const STATUSES = [
  "opened",
  "partially_filled",
  "ready_for_submit",
  "manual_required",
  "blocked",
  "applied",
  "rejected",
  "interviewing",
];

export function ApplicationsTable({
  applications,
  onUpdated,
}: {
  applications: Application[];
  onUpdated?: () => void;
}) {
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function handleStatusChange(jobId: number, status: string) {
    try {
      setLoadingId(jobId);
      await updateApplication(jobId, status);
      onUpdated?.();
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Status</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id}>
              <td>
                <strong>{application.job_title ?? "Unknown job"}</strong>
                <div className="metric-note">{application.company ?? "Unknown company"}</div>
              </td>
              <td>
                <span className="status-pill" data-status={application.status}>
                  {application.status}
                </span>
              </td>
              <td>{application.applied_at ?? "Not set"}</td>
              <td>
                <select
                  defaultValue={application.status}
                  onChange={(event) => handleStatusChange(application.job_id, event.target.value)}
                  disabled={loadingId === application.job_id}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {applications.length === 0 ? <div className="empty">No application records yet.</div> : null}
    </div>
  );
}
