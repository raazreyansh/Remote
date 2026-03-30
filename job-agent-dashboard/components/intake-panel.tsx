"use client";

import { useState } from "react";

import { type Profile, refreshJobs, uploadResume } from "@/lib/api";

export function IntakePanel({
  profile,
  onProfileChange,
  onRefreshComplete,
}: {
  profile: Profile | null;
  onProfileChange?: (profile: Profile) => void;
  onRefreshComplete?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preferredLocations, setPreferredLocations] = useState("Remote");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) {
      setError("Choose a PDF resume first.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setMessage("");
      const result = await uploadResume(file, preferredLocations);
      onProfileChange?.(result.profile);
      onRefreshComplete?.();
      setMessage(
        `Resume parsed, fetched ${result.fetched_count} jobs, saved ${result.new_jobs} new roles, and rescored ${result.updated_jobs} jobs.`,
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Resume upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError("");
      setMessage("");
      const result = await refreshJobs({ includeListingSites: true });
      onRefreshComplete?.();
      setMessage(
        `Fetched ${result.fetched_count} jobs, saved ${result.new_jobs} new roles, and rescored ${result.rescored_jobs} jobs.`,
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Job refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="panel intake-panel">
      <div className="section-row">
        <div>
          <h2 className="section-title">Resume-first search</h2>
          <p className="subtitle">
            Upload your resume, extract your profile, then fetch fresh remote roles and rank them by fit.
          </p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => void handleRefresh()} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Fetch Latest Jobs"}
          </button>
        </div>
      </div>

      <div className="intake-grid">
        <div className="panel intake-upload">
          <div className="metric-label">Resume Upload</div>
          <div className="field">
            <label htmlFor="resume-upload">PDF Resume</label>
            <input
              id="resume-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="field">
            <label htmlFor="preferred-locations">Preferred Locations</label>
            <input
              id="preferred-locations"
              value={preferredLocations}
              onChange={(event) => setPreferredLocations(event.target.value)}
              placeholder="Remote, United States, Europe"
            />
          </div>
          <div className="button-row">
            <button className="button" onClick={() => void handleUpload()} disabled={uploading}>
              {uploading ? "Parsing Resume..." : "Upload Resume"}
            </button>
          </div>
        </div>

        <div className="panel intake-summary">
          <div className="metric-label">Parsed Profile</div>
          {profile ? (
            <div className="stack">
              <div>
                <strong>Target roles</strong>
                <div className="chip-row">
                  {profile.roles.slice(0, 6).map((role) => (
                    <span className="source-pill" key={role}>
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <strong>Key skills</strong>
                <div className="chip-row">
                  {profile.skills.slice(0, 8).map((skill) => (
                    <span className="source-pill" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <p className="metric-note">
                {profile.experience.length} experience entries, {profile.projects.length} projects,{" "}
                {profile.education.length} education entries.
              </p>
            </div>
          ) : (
            <div className="empty">Upload a resume to create a matching profile and score jobs against it.</div>
          )}
        </div>
      </div>

      {message ? <div className="notice notice-success">{message}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}
    </section>
  );
}
