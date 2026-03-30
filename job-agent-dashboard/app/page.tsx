"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { IntakePanel } from "@/components/intake-panel";
import { type Profile, getProfile } from "@/lib/api";

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setProfile(await getProfile());
      } catch {
        setProfile(null);
      }
    }

    void loadProfile();
  }, []);

  return (
    <div className="stack">
      <section className="hero hero-home panel">
        <div className="hero-copy">
          <div className="eyebrow">Resume To Role Match</div>
          <h2 className="section-title hero-title">Upload once, fetch fresh remote jobs, and act on the best-fit roles.</h2>
          <p className="hero-text">
            This web app parses your resume, builds a profile, pulls jobs from ATS sources and remote-job sites, scores
            them for fit, and hands you direct apply targets instead of endless browsing.
          </p>
          <div className="button-row">
            <Link className="button" href="/dashboard">
              Open Matching Dashboard
            </Link>
            <Link className="button secondary" href="/jobs">
              See Ranked Jobs
            </Link>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span>Resume intake</span>
              <strong>PDF upload + AI profile extraction</strong>
            </div>
            <div className="hero-metric">
              <span>Fresh sourcing</span>
              <strong>Remote listings + ATS job sources</strong>
            </div>
            <div className="hero-metric">
              <span>Action mode</span>
              <strong>Direct apply where available</strong>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="spotlight-card spotlight-main">
            <div className="spotlight-label">How it works</div>
            <h3>Upload. Refresh. Apply.</h3>
            <p>
              Start with your resume, sync the latest remote jobs, then work from the highest-confidence matches first.
            </p>
          </div>
          <div className="spotlight-grid">
            <div className="spotlight-card">
              <div className="spotlight-label">Matching</div>
              <p>Skills, role fit, semantics, and location signals combine into a ranked queue.</p>
            </div>
            <div className="spotlight-card">
              <div className="spotlight-label">Apply flow</div>
              <p>Open the job fast and trigger direct-apply flows for ATS-friendly targets.</p>
            </div>
          </div>
        </div>
      </section>

      <IntakePanel profile={profile} onProfileChange={setProfile} />

      <section className="grid feature-grid">
        <article className="panel feature-card">
          <div className="feature-step">01</div>
          <h3 className="feature-title">Parse the resume</h3>
          <p className="feature-copy">
            Extract skills, experience, projects, and target roles into a profile the ranking engine can use.
          </p>
        </article>
        <article className="panel feature-card">
          <div className="feature-step">02</div>
          <h3 className="feature-title">Pull latest remote jobs</h3>
          <p className="feature-copy">
            Fetch from remote job boards and direct ATS sources so the list stays current instead of going stale.
          </p>
        </article>
        <article className="panel feature-card">
          <div className="feature-step">03</div>
          <h3 className="feature-title">Prioritize direct apply</h3>
          <p className="feature-copy">
            Focus on roles that best match your resume and surface direct apply opportunities wherever possible.
          </p>
        </article>
      </section>
    </div>
  );
}
