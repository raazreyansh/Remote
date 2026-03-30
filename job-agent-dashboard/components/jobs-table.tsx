"use client";

import Link from "next/link";
import { useState } from "react";

import { type Job, triggerApply } from "@/lib/api";

export function JobsTable({
  jobs,
  showApply = true,
  onApplied,
}: {
  jobs: Job[];
  showApply?: boolean;
  onApplied?: () => void;
}) {
  const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");

  async function handleApply(jobId: number) {
    try {
      setLoadingJobId(jobId);
      setMessage("");
      await triggerApply(jobId);
      setMessage("Apply flow launched. Review the browser and submit manually if the form is ready.");
      onApplied?.();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Apply request failed";
      setMessage(text);
    } finally {
      setLoadingJobId(null);
    }
  }

  return (
    <div className="stack">
      {message ? <div className="notice notice-success">{message}</div> : null}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Company</th>
              <th>Score</th>
              <th>Source</th>
              <th>Application</th>
              {showApply ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.title}</strong>
                  <div className="metric-note">{job.location}</div>
                </td>
                <td>{job.company}</td>
                <td>
                  <span className="score-pill">{job.final_score.toFixed(2)}</span>
                  <div className="metric-note">semantic {job.semantic_score.toFixed(1)}</div>
                </td>
                <td>
                  <div className="button-row">
                    <span className="source-pill">{job.source}</span>
                    <span className="source-pill">{job.ats_provider}</span>
                  </div>
                </td>
                <td>
                  <span className="status-pill" data-status={job.application_type}>
                    {job.application_type}
                  </span>
                </td>
                {showApply ? (
                  <td>
                    <div className="button-row">
                      <Link className="button secondary" href={`/jobs/${job.id}`}>
                        Details
                      </Link>
                      <a className="button secondary" href={job.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      <button
                        className="button"
                        onClick={() => handleApply(job.id)}
                        disabled={loadingJobId === job.id || job.application_type !== "direct"}
                      >
                        {loadingJobId === job.id ? "Launching..." : "Apply"}
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobs.length === 0 ? <div className="empty">No jobs matched the current filters.</div> : null}
    </div>
  );
}
