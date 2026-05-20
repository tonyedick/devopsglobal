// =============================================================================
// DevOps.global — Recruiter View Edge Function
// =============================================================================
// File path inside your Supabase project:
//   supabase/functions/recruiter-view/index.ts
//
// What this function does:
//   1. Accepts a POST { password: string } from recruiter.html.
//   2. Verifies the password against the RECRUITER_VIEW_PASSWORD env var.
//   3. If correct, queries intake.candidates with NO filter — every row.
//   4. Generates a 1-hour signed URL for each candidate's CV file.
//   5. Returns { candidates: [...] } with all candidate-relevant columns.
//
// Environment variables (Supabase Dashboard → Project Settings → Edge Functions
// → Secrets):
//   SUPABASE_URL                 (auto-populated)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-populated)
//   RECRUITER_VIEW_PASSWORD      (you set — distinct from JOBCOACH_VIEW_PASSWORD)
//   ALLOWED_ORIGIN               (e.g. https://intake.devops.global)
//
// Deploy:
//   supabase functions deploy recruiter-view --no-verify-jwt
//
// Set the password (replace the placeholder):
//   supabase secrets set RECRUITER_VIEW_PASSWORD='use-a-strong-passphrase'
//
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ---------- Env ----------
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY          = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECRUITER_VIEW_PASSWORD   = Deno.env.get("RECRUITER_VIEW_PASSWORD") ?? "";
const ALLOWED_ORIGIN            = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

// ---------- Constants ----------
const CV_BUCKET           = "cv-uploads";
const SIGNED_URL_SECONDS  = 60 * 60;        // 1 hour
const REQUEST_TIMEOUT_MS  = 25_000;

// Naive in-memory per-IP rate limit (per warm instance)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 10;
const recentByIp     = new Map<string, number[]>();

// ---------- Helpers ----------
function cors(extra: HeadersInit = {}): HeadersInit {
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Access-Control-Max-Age":       "86400",
    "Content-Type":                 "application/json; charset=utf-8",
    "X-Content-Type-Options":       "nosniff",
    "Referrer-Policy":              "no-referrer",
    ...extra,
  };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: cors() });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function rateLimited(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const arr = (recentByIp.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) return true;
  arr.push(now);
  recentByIp.set(ip, arr);
  return false;
}

// ---------- Supabase ----------
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method-not-allowed" });
  }

  const ip =
    (req.headers.get("cf-connecting-ip") ??
     req.headers.get("x-real-ip") ??
     req.headers.get("x-forwarded-for") ?? "")
      .split(",")[0]
      .trim();

  if (rateLimited(ip)) {
    return jsonResponse(429, { error: "rate-limited" });
  }

  const timeout = new Promise<Response>((resolve) =>
    setTimeout(() => resolve(jsonResponse(408, { error: "request-timeout" })), REQUEST_TIMEOUT_MS)
  );

  const work = (async () => {
    // ---------- Body ----------
    let body: { password?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "invalid-json" });
    }
    const submitted = (body?.password ?? "").toString();

    if (!RECRUITER_VIEW_PASSWORD) {
      console.error("RECRUITER_VIEW_PASSWORD not configured");
      return jsonResponse(500, { error: "server-not-configured" });
    }
    if (!submitted || !timingSafeEqual(submitted, RECRUITER_VIEW_PASSWORD)) {
      return jsonResponse(401, { error: "unauthorized" });
    }

    // ---------- Query ALL candidates, ALL relevant columns, NO filter ----------
    // We explicitly select the columns the recruiter UI displays, so we don't
    // leak ip_hash / user_agent_hash / turnstile_action by accident.
    const SELECT_COLS = [
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
      "proud_project",
      "portfolio_url",
      "github_url",
      "availability",
      "current_status",
      "salary_expectation",
      "engagement_type",
      "work_model",
      "other_processes",
      "english_level",
      "english_interview",
      "international_exp",
      "consent_pool",
      "consent_intro",
      "consent_jobcoach",
      "notes",
      "cv_storage_path",
      "cv_original_name",
      "cv_size_bytes",
      "cv_mime_type",
      "priority",
      "recommendation",
      "stage",
      "next_step",
      "next_step_date",
      "recruiter_comment",
    ].join(",");

    const { data: rows, error } = await supabase
      .schema("intake")
      .from("candidates")
      .select(SELECT_COLS)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("db query error:", error);
      return jsonResponse(500, { error: "db-query-failed" });
    }

    // ---------- Generate signed CV URLs in parallel ----------
    const candidates = await Promise.all(
      (rows ?? []).map(async (row: any) => {
        let cv_url: string | null = null;
        if (row.cv_storage_path) {
          const { data: signed, error: signErr } = await supabase
            .storage
            .from(CV_BUCKET)
            .createSignedUrl(row.cv_storage_path, SIGNED_URL_SECONDS);
          if (signErr) {
            console.warn(`signed-url failed for ${row.cv_storage_path}:`, signErr.message);
          } else {
            cv_url = signed?.signedUrl ?? null;
          }
        }
        return { ...row, cv_url };
      })
    );

    return jsonResponse(200, { candidates });
  })();

  return await Promise.race([work, timeout]);
});
