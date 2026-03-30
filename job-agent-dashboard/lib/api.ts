export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  source: string;
  match_score: number;
  skills_match_score: number;
  semantic_score: number;
  final_score: number;
  ats_provider: string;
  application_type: string;
  direct_apply: boolean;
  freshness_bucket: string;
  created_at: string;
  fit_breakdown?: {
    skills_score: number;
    experience_score: number;
    role_score: number;
    location_score: number;
    semantic_score: number;
    final_score: number;
    embedding_source: string;
    score_explanation: string;
  };
};

export type Application = {
  id: number;
  job_id: number;
  job_title: string | null;
  company: string | null;
  status: string;
  applied_at: string | null;
};

export type Analytics = {
  total_jobs: number;
  top_jobs_count: number;
  applications_sent: number;
  response_rate: number;
};

export type Profile = {
  skills: string[];
  experience: Array<Record<string, unknown> | string>;
  projects: Array<Record<string, unknown> | string>;
  education: Array<Record<string, unknown> | string>;
  roles: string[];
  preferred_locations?: string[];
};

export async function getAnalytics(): Promise<Analytics> {
  return request<Analytics>("/analytics");
}

export async function getProfile(): Promise<Profile | null> {
  const data = await request<{ profile: Profile | null }>("/profile");
  return data.profile;
}

export async function updateProfile(profile: Profile): Promise<{ profile: Profile; updated_jobs: number }> {
  return request("/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
}

export async function uploadResume(file: File, preferredLocations = "Remote"): Promise<{
  profile: Profile;
  resume_path: string;
  fetched_count: number;
  new_jobs: number;
  updated_jobs: number;
}> {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("preferred_locations", preferredLocations);
  return request("/profile/upload-resume", {
    method: "POST",
    body: formData,
  });
}

export async function refreshJobs(params?: {
  directOnly?: boolean;
  includeListingSites?: boolean;
}): Promise<{ fetched_count: number; new_jobs: number; rescored_jobs: number }> {
  const query = new URLSearchParams();
  if (params?.directOnly) query.set("direct_only", "true");
  if (params?.includeListingSites === false) query.set("include_listing_sites", "false");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request(`/jobs/refresh${suffix}`, { method: "POST" });
}

export async function getTopJobs(threshold = 70): Promise<Job[]> {
  const data = await request<{ items: Job[] }>(`/jobs/top?threshold=${threshold}`);
  return data.items;
}

export async function getReadyToApply(threshold = 70, source = ""): Promise<Job[]> {
  const query = new URLSearchParams({ threshold: String(threshold) });
  if (source) query.set("source", source);
  const data = await request<{ items: Job[] }>(`/jobs/ready-to-apply?${query.toString()}`);
  return data.items;
}

export async function getAllJobs(params: {
  page?: number;
  pageSize?: number;
  minScore?: number;
  source?: string;
  directOnly?: boolean;
}): Promise<{ items: Job[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("page_size", String(params.pageSize ?? 20));
  if (params.minScore !== undefined) query.set("min_score", String(params.minScore));
  if (params.source) query.set("source", params.source);
  if (params.directOnly) query.set("direct_only", "true");
  return request(`/jobs/all?${query.toString()}`);
}

export async function getJob(jobId: number): Promise<Job> {
  return request<Job>(`/jobs/${jobId}`);
}

export async function getApplications(status = ""): Promise<Application[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await request<{ items: Application[] }>(`/applications${query}`);
  return data.items;
}

export async function triggerApply(jobId: number): Promise<unknown> {
  return request(`/applications/${jobId}/apply`, { method: "POST" });
}

export async function updateApplication(jobId: number, status: string): Promise<unknown> {
  return request(`/applications/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
