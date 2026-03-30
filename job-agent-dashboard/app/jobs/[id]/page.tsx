"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { type Job, getJob, triggerApply } from "@/lib/api";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        setJob(await getJob(Number(params.id)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load job detail.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.id]);

  async function handleApply() {
    if (!job) return;
    try {
      setApplying(true);
      setMessage("");
      await triggerApply(job.id);
      setMessage("Apply flow launched. Review the browser and complete any remaining steps.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply flow failed.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <section className="panel notice"><h2 className="notice-title">Loading role analysis</h2></section>;
  }

  if (error && !job) {
    return <section className="panel notice notice-error"><h2 className="notice-title">Unable to load job</h2><p className="notice-copy">{error}</p></section>;
  }

  if (!job) {
    return <section className="panel empty">Job not found.</section>;
  }

  const breakdown = job.fit_breakdown;

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="section-row">
          <div>
            <div className="eyebrow">Job Detail</div>
            <h2 className="section-title">{job.title}</h2>
            <p className="subtitle">
              {job.company} · {job.location} · {job.source}
            </p>
          </div>
          <div className="button-row">
            <a className="button secondary" href={job.url} target="_blank" rel="noreferrer">
              Open Original Job
            </a>
            <button className="button" disabled={!job.direct_apply || applying} onClick={() => void handleApply()}>
              {applying ? "Launching..." : job.direct_apply ? "Direct Apply" : "Manual Review"}
            </button>
          </div>
        </div>

        <div className="grid cards">
          <div className="card">
            <div className="metric-label">Final Match</div>
            <p className="metric-value">{job.final_score.toFixed(1)}</p>
            <p className="metric-note">Overall rank after weighting resume fit, semantics, and remote fit.</p>
          </div>
          <div className="card">
            <div className="metric-label">Direct Apply</div>
            <p className="metric-value">{job.direct_apply ? "Yes" : "No"}</p>
            <p className="metric-note">Application flow type detected from the target URL.</p>
          </div>
          <div className="card">
            <div className="metric-label">Freshness</div>
            <p className="metric-value">{job.freshness_bucket.replace("_", " ")}</p>
            <p className="metric-note">Use this to prioritize newest roles first.</p>
          </div>
        </div>
      </section>

      {breakdown ? (
        <section className="panel stack">
          <div>
            <h3 className="section-title">Why this role matches</h3>
            <p className="subtitle">{breakdown.score_explanation}</p>
          </div>
          <div className="grid cards">
            <div className="card"><div className="metric-label">Skills</div><p className="metric-value">{breakdown.skills_score}</p></div>
            <div className="card"><div className="metric-label">Experience</div><p className="metric-value">{breakdown.experience_score}</p></div>
            <div className="card"><div className="metric-label">Role Fit</div><p className="metric-value">{breakdown.role_score}</p></div>
            <div className="card"><div className="metric-label">Location Fit</div><p className="metric-value">{breakdown.location_score}</p></div>
            <div className="card"><div className="metric-label">Semantic</div><p className="metric-value">{breakdown.semantic_score}</p></div>
          </div>
        </section>
      ) : null}

      <section className="panel stack">
        <h3 className="section-title">Role summary</h3>
        <p className="job-description">{job.description || "No job description available."}</p>
        <div className="button-row">
          <Link className="button secondary" href="/jobs">
            Back To Jobs
          </Link>
        </div>
      </section>

      {message ? <div className="notice notice-success">{message}</div> : null}
      {error && job ? <div className="notice notice-error">{error}</div> : null}
    </div>
  );
}
