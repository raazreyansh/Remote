"use client";

import { useEffect, useState } from "react";

import { type Profile, getProfile, updateProfile } from "@/lib/api";

function listToText(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState("");
  const [roles, setRoles] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const loaded = await getProfile();
        setProfile(loaded);
        if (loaded) {
          setSkills(listToText(loaded.skills));
          setRoles(listToText(loaded.roles));
          setPreferredLocations(listToText(loaded.preferred_locations));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
      }
    }

    void load();
  }, []);

  async function handleSave() {
    if (!profile) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");
      const payload: Profile = {
        ...profile,
        skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
        roles: roles.split(",").map((item) => item.trim()).filter(Boolean),
        preferred_locations: preferredLocations.split(",").map((item) => item.trim()).filter(Boolean),
      };
      const result = await updateProfile(payload);
      setProfile(result.profile);
      setMessage(`Profile saved and ${result.updated_jobs} jobs rescored.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="section-row">
        <div>
          <h2 className="section-title">Candidate Profile</h2>
          <p className="subtitle">Review the extracted profile, refine target signals, and keep ranking behavior precise.</p>
        </div>
      </div>

      {!profile ? <div className="empty">Upload a resume first to create your profile.</div> : null}

      {profile ? (
        <div className="profile-grid">
          <div className="panel">
            <div className="field">
              <label htmlFor="profile-roles">Target Roles</label>
              <input id="profile-roles" value={roles} onChange={(event) => setRoles(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="profile-skills">Core Skills</label>
              <textarea
                id="profile-skills"
                className="textarea"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="profile-locations">Preferred Locations</label>
              <input
                id="profile-locations"
                value={preferredLocations}
                onChange={(event) => setPreferredLocations(event.target.value)}
              />
            </div>
            <div className="button-row">
              <button className="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>

          <div className="panel stack">
            <div>
              <div className="metric-label">Experience Entries</div>
              <p className="metric-value">{profile.experience.length}</p>
              <p className="metric-note">Parsed roles and experience records used for scoring.</p>
            </div>
            <div>
              <div className="metric-label">Projects</div>
              <p className="metric-value">{profile.projects.length}</p>
              <p className="metric-note">Project context helps improve semantic fit and keyword overlap.</p>
            </div>
            <div>
              <div className="metric-label">Education</div>
              <p className="metric-value">{profile.education.length}</p>
              <p className="metric-note">Educational context is stored for resume generation and matching.</p>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <div className="notice notice-success">{message}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}
    </section>
  );
}
