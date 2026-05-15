/**
 * Supabase Edge Function: jobcoach-view
 *
 * Deploy to: supabase/functions/jobcoach-view/index.ts
 *
 * Required secrets (set via Supabase Dashboard → Edge Functions → Secrets,
 * or `supabase secrets set JOBCOACH_PASSWORD=yourpassword`):
 *
 *   JOBCOACH_PASSWORD       — the plain-text password you give your boss
 *   SUPABASE_URL            — auto-set by Supabase runtime
 *   SUPABASE_SERVICE_ROLE_KEY — auto-set by Supabase runtime
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CV_SIGNED_URL_TTL = 60 * 60; // 1 hour

// Columns to return to the client (exclude sensitive internals)
const SELECT_COLUMNS = [
  "id",
  "submitted_at",
  "name",
  "email",
  "phone",
  "linkedin",
  "location",
  "timezone",
  "current_role_name",
  "desired_role",
  "years_experience",
  "languages",
  "main_skills",
  "frontend_skills",
  "backend_skills",
  "devops_skills",
  "fullstack_skills",
  "availability",
  "current_status",
  "salary_expectation",
  "engagement_type",
  "work_model",
  "english_level",
  "english_interview",
  "international_exp",
  "stage",
  "priority",
  "recommendation",
  "recruiter_comment",
  "next_step",
  "next_step_date",
  "cv_storage_path",
  "cv_original_name",
  "cv_size_bytes",
  "notes",
].join(",");

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    // ── 1. Parse & validate password ──────────────────────────────────────
    let body: { password?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const correctPw = Deno.env.get("JOBCOACH_PASSWORD");
    if (!correctPw) {
      console.error("JOBCOACH_PASSWORD secret is not set");
      return json({ error: "server_misconfigured" }, 500);
    }
    if (!body.password || body.password !== correctPw) {
      // Small delay to slow brute force
      await new Promise((r) => setTimeout(r, 400));
      return json({ error: "unauthorized" }, 401);
    }

    // ── 2. Build Supabase client with service role (bypasses RLS) ─────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── 3. Fetch jobcoach candidates ───────────────────────────────────────
    const { data: candidates, error: dbErr } = await supabase
      .from("candidates")
      .select(SELECT_COLUMNS)
      .eq("consent_jobcoach", true)
      .order("submitted_at", { ascending: false });

    if (dbErr) {
      console.error("DB error:", dbErr);
      return json({ error: "db_error", detail: dbErr.message }, 500);
    }

    // ── 4. Generate signed CV URLs ────────────────────────────────────────
    const results = await Promise.all(
      (candidates ?? []).map(async (c) => {
        let cv_url: string | null = null;
        if (c.cv_storage_path) {
          const { data: signed, error: storageErr } = await supabase.storage
            .from("cv_uploads")
            .createSignedUrl(c.cv_storage_path, CV_SIGNED_URL_TTL);
          if (storageErr) {
            console.warn(`Signed URL failed for ${c.cv_storage_path}:`, storageErr.message);
          }
          cv_url = signed?.signedUrl ?? null;
        }
        return { ...c, cv_url };
      })
    );

    return json({ candidates: results });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
