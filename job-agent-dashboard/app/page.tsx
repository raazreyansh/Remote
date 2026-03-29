import Link from "next/link";

export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero hero-home panel">
        <div className="hero-copy">
          <div className="eyebrow">System Overview</div>
          <h2 className="section-title hero-title">A focused job search workspace with fewer tabs and better signals.</h2>
          <p className="hero-text">
            Review ranked roles, see what is actually ready to submit, and keep your search organized without drowning in
            spreadsheets or scattered notes.
          </p>
          <div className="button-row">
            <Link className="button" href="/dashboard">
              Open Dashboard
            </Link>
            <Link className="button secondary" href="/jobs">
              Browse Jobs
            </Link>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span>Signal-first</span>
              <strong>Ranked ATS targets</strong>
            </div>
            <div className="hero-metric">
              <span>Action-ready</span>
              <strong>Apply flow handoff</strong>
            </div>
            <div className="hero-metric">
              <span>Pipeline clarity</span>
              <strong>Status tracking built in</strong>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="spotlight-card spotlight-main">
            <div className="spotlight-label">Daily Priority</div>
            <h3>Ready to apply</h3>
            <p>Surface the high-score direct ATS roles that are worth your attention today.</p>
          </div>
          <div className="spotlight-grid">
            <div className="spotlight-card">
              <div className="spotlight-label">Job Intake</div>
              <p>Score incoming roles by skill match, semantics, and source quality.</p>
            </div>
            <div className="spotlight-card">
              <div className="spotlight-label">Applications</div>
              <p>Track blocked, manual, and applied states without losing momentum.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid feature-grid">
        <article className="panel feature-card">
          <div className="feature-step">01</div>
          <h3 className="feature-title">Rank what matters</h3>
          <p className="feature-copy">
            Pull jobs into one place and sort them by strength instead of bouncing between ATS tabs and saved links.
          </p>
        </article>
        <article className="panel feature-card">
          <div className="feature-step">02</div>
          <h3 className="feature-title">Act on the right set</h3>
          <p className="feature-copy">
            Keep your ready-to-apply queue separate from low-confidence roles so daily effort stays sharp.
          </p>
        </article>
        <article className="panel feature-card">
          <div className="feature-step">03</div>
          <h3 className="feature-title">Track outcomes cleanly</h3>
          <p className="feature-copy">
            Move applications through manual review, submission, and interview stages from one dashboard.
          </p>
        </article>
      </section>
    </div>
  );
}
