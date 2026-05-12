-- =============================================================================
-- DevOps.global Candidate Intake — Supabase schema + Row-Level Security
-- =============================================================================
-- HOW TO USE:
--   1. Open your Supabase project → SQL Editor → New Query
--   2. Paste the ENTIRE contents of this file
--   3. Click "Run"
--   4. Verify in Table Editor that table `candidates` and bucket `cv-uploads`
--      both exist, and that RLS is ON.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions we rely on
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Schema for our intake data
-- ---------------------------------------------------------------------------
create schema if not exists intake;

-- ---------------------------------------------------------------------------
-- 3. Main candidates table
-- ---------------------------------------------------------------------------
-- Notes on column choices:
--   • All free-text fields have a LENGTH cap to prevent unbounded payloads.
--   • Emails use citext (case-insensitive) + a CHECK regex.
--   • LinkedIn / portfolio / github URLs require https://.
--   • Sensitive PII (name, email, phone) is stored plaintext for now;
--     see §11 of the walkthrough if you later want column-level encryption.
--   • cv_storage_path is the path inside the private bucket, NOT a public URL.
-- ---------------------------------------------------------------------------

create table if not exists intake.candidates (
    id                  uuid primary key default gen_random_uuid(),
    submitted_at        timestamptz not null default now(),

    -- Basic details
    name                text     not null check (char_length(name) between 2 and 120),
    email               citext   not null check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
                                                 and char_length(email) <= 254),
    phone               text     check (phone is null or char_length(phone) between 6 and 32),
    linkedin            text     not null check (linkedin ~ '^https://([a-z0-9-]+\.)?linkedin\.com/'
                                                 and char_length(linkedin) <= 300),
    location            text     not null check (char_length(location) between 2 and 120),
    timezone            text     not null check (char_length(timezone) between 1 and 40),

    -- Role & experience
    current_role        text     not null check (char_length(current_role) between 2 and 120),
    desired_role        text     not null check (desired_role in (
                            'DevOps Engineer','Cloud Engineer','Site Reliability Engineer',
                            'Platform Engineer','Kubernetes Engineer','Terraform Engineer',
                            'Frontend Engineer','Backend Engineer','Full Stack Engineer',
                            'Core Team Member (FE+BE+DevOps)'
                        )),
    years_experience    smallint not null check (years_experience between 0 and 50),
    languages           text     not null check (char_length(languages) between 2 and 200),

    -- Skills
    main_skills         text     not null check (char_length(main_skills) between 3 and 500),
    frontend_skills     text     check (frontend_skills is null or char_length(frontend_skills) <= 300),
    backend_skills      text     check (backend_skills  is null or char_length(backend_skills)  <= 300),
    devops_skills       text     check (devops_skills   is null or char_length(devops_skills)   <= 300),
    proud_project       text     not null check (char_length(proud_project) between 10 and 2000),
    portfolio_url       text     check (portfolio_url is null or
                            (portfolio_url ~ '^https://' and char_length(portfolio_url) <= 300)),
    github_url          text     check (github_url is null or
                            (github_url ~ '^https://(www\.)?github\.com/' and char_length(github_url) <= 300)),

    -- Availability & commercials
    availability        text     not null check (char_length(availability) between 2 and 200),
    current_status      text     not null check (current_status in (
                            'Employed - not actively looking','Employed - open to opportunities',
                            'Employed - actively looking','Freelancing','Between roles',
                            'On notice period','On the bench'
                        )),
    salary_expectation  text     not null check (char_length(salary_expectation) between 2 and 100),
    engagement_type     text     check (engagement_type is null or engagement_type in (
                            'Full-time','Part-time','Contract / Freelance','Open to either'
                        )),
    work_model          text     not null check (work_model in (
                            'Remote only','Hybrid','Onsite','Remote + open to relocation','Relocation only'
                        )),
    other_processes     text     check (other_processes is null or char_length(other_processes) <= 100),

    -- Communication
    english_level       text     not null check (english_level in (
                            'A2 — basic','B1 — intermediate','B2 — upper intermediate',
                            'C1 — advanced','C2 / native'
                        )),
    english_interview   text     not null check (english_interview in (
                            'Yes — fully comfortable','Yes — with brief prep',
                            'Prefer some Jobcoach prep first','Not yet'
                        )),
    international_exp   text     check (international_exp is null or char_length(international_exp) <= 500),

    -- Consent (all must be true for a valid submission; enforced by Edge Function)
    consent_pool        boolean  not null check (consent_pool = true),
    consent_intro       boolean  not null check (consent_intro = true),
    consent_jobcoach    boolean  not null default false,

    -- Notes
    notes               text     check (notes is null or char_length(notes) <= 1000),

    -- CV upload metadata (path inside the private bucket; not a public URL)
    cv_storage_path     text     check (cv_storage_path is null or char_length(cv_storage_path) <= 300),
    cv_original_name    text     check (cv_original_name is null or char_length(cv_original_name) <= 200),
    cv_size_bytes       integer  check (cv_size_bytes is null or cv_size_bytes between 1 and 10485760), -- 10 MB
    cv_mime_type        text     check (cv_mime_type is null or cv_mime_type in (
                            'application/pdf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        )),

    -- Audit / abuse
    ip_hash             text     check (ip_hash is null or char_length(ip_hash) = 64),  -- sha256 hex
    user_agent_hash     text     check (user_agent_hash is null or char_length(user_agent_hash) = 64),
    turnstile_action    text     check (turnstile_action is null or char_length(turnstile_action) <= 50),

    -- Tracker workflow columns (you update these from the recruiter side)
    priority            text     check (priority is null or priority in ('A','B','C')),
    recommendation      text     check (recommendation is null or recommendation in (
                            'client-ready','talent pool','not suitable','open'
                        )),
    stage               text     check (stage is null or stage in (
                            'New','Stage 1: Rec Check','Stage 2: Tech Assess',
                            'Stage 3: Jobcoach','Client-Ready','Rejected'
                        )),
    next_step           text     check (next_step is null or char_length(next_step) <= 300),
    next_step_date      date,
    recruiter_comment   text     check (recruiter_comment is null or char_length(recruiter_comment) <= 2000)
);

-- Helpful indexes
create index if not exists candidates_submitted_at_idx on intake.candidates (submitted_at desc);
create index if not exists candidates_email_idx        on intake.candidates (email);
create index if not exists candidates_priority_idx     on intake.candidates (priority) where priority is not null;
create index if not exists candidates_stage_idx        on intake.candidates (stage)    where stage is not null;
create index if not exists candidates_desired_role_idx on intake.candidates (desired_role);

-- ---------------------------------------------------------------------------
-- 4. Lock down direct access — Row Level Security
-- ---------------------------------------------------------------------------
-- Default deny posture:
--   • The anon role cannot SELECT, UPDATE or DELETE anything.
--   • The anon role cannot directly INSERT either (Edge Function uses
--     service_role to insert).
--   • Only authenticated users with role 'recruiter' (a JWT claim) can read
--     and update.
--   • The service_role bypasses RLS by design — only the Edge Function
--     uses it, and it's never exposed to the browser.
-- ---------------------------------------------------------------------------

alter table intake.candidates enable row level security;

-- Belt-and-suspenders: revoke everything from non-service roles first
revoke all on intake.candidates from anon, authenticated;

-- Authenticated recruiters can SELECT
create policy "recruiters can read candidates"
on intake.candidates for select to authenticated
using ( auth.jwt() ->> 'user_role' = 'recruiter' );

-- Authenticated recruiters can UPDATE recruiter-side fields only
create policy "recruiters can update workflow fields"
on intake.candidates for update to authenticated
using ( auth.jwt() ->> 'user_role' = 'recruiter' )
with check ( auth.jwt() ->> 'user_role' = 'recruiter' );

-- Nobody (other than service_role) can DELETE. If you ever need to delete,
-- do it from the SQL editor — that's an explicit privileged action.

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for CVs (private, never public)
-- ---------------------------------------------------------------------------
-- Create the bucket if it doesn't exist. `public = false` is the critical bit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'cv-uploads',
    'cv-uploads',
    false,
    10485760,  -- 10 MB hard limit at the bucket level
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
-- Anon role: NO direct upload, NO read.  All uploads go through the Edge Function.
-- Authenticated recruiters: can read (to download CVs they're reviewing).

-- First, ensure all permissive policies on this bucket are gone
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    -- Only drop the ones we manage (named with our prefix) so we don't
    -- nuke other buckets' policies if you have more than one.
    if p.policyname like 'cv-uploads:%' then
      execute format('drop policy if exists %I on storage.objects', p.policyname);
    end if;
  end loop;
end$$;

create policy "cv-uploads: recruiters can read CV objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'cv-uploads'
  and auth.jwt() ->> 'user_role' = 'recruiter'
);

-- Note: we do NOT add an INSERT policy for anon or authenticated.
-- Only the service_role (used by the Edge Function) can insert, because
-- service_role bypasses RLS. This is intentional.

-- ---------------------------------------------------------------------------
-- 6. Optional: an audit/abuse log (handy if you start getting bot traffic)
-- ---------------------------------------------------------------------------
create table if not exists intake.submission_rejects (
    id            uuid primary key default gen_random_uuid(),
    rejected_at   timestamptz not null default now(),
    reason        text not null check (char_length(reason) <= 200),
    ip_hash       text check (ip_hash is null or char_length(ip_hash) = 64),
    user_agent    text check (user_agent is null or char_length(user_agent) <= 500),
    details       jsonb
);
alter table intake.submission_rejects enable row level security;
revoke all on intake.submission_rejects from anon, authenticated;

create policy "recruiters can read reject log"
on intake.submission_rejects for select to authenticated
using ( auth.jwt() ->> 'user_role' = 'recruiter' );

-- ---------------------------------------------------------------------------
-- 7. Grant USAGE on the schema (NOT on the table; RLS still gates rows)
-- ---------------------------------------------------------------------------
grant usage on schema intake to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Convenience view (optional) — flat shape for exports to your Excel Tracker
-- ---------------------------------------------------------------------------
create or replace view intake.candidates_export as
select
    id,
    to_char(submitted_at, 'YYYY-MM-DD') as date_added,
    name, email, phone, linkedin,
    location, timezone,
    current_role, desired_role,
    years_experience as years_exp,
    main_skills, frontend_skills, backend_skills, devops_skills,
    languages,
    availability, salary_expectation, work_model, current_status,
    case when cv_storage_path is null then 'No' else 'Yes' end as cv_uploaded,
    priority, recommendation, stage, next_step, next_step_date, recruiter_comment,
    proud_project
from intake.candidates
order by submitted_at desc;

-- Grant select on the view to authenticated recruiters
grant select on intake.candidates_export to authenticated;

-- =============================================================================
-- Done.
-- Next steps:
--   1. Deploy the Edge Function in `supabase_edge_function.ts`
--   2. Set its environment variables (TURNSTILE_SECRET, etc.)
--   3. Deploy the v2 HTML form
-- =============================================================================
