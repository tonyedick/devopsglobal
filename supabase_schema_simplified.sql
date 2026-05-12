-- =============================================================================
-- DevOps.global Candidate Intake — SIMPLIFIED (for an existing Supabase project)
-- =============================================================================
-- This version assumes your existing product already handles:
--   • admin/recruiter authentication
--   • dashboard / UI access control
--   • whatever read/update authorization model fits your app
--
-- So this script does ONLY the strict minimum needed for the candidate intake:
--   • Schema + table + constraints
--   • Storage bucket (private)
--   • RLS enabled in default-deny mode (no permissive policies — your app
--     reads via its own service_role connection OR you'll add policies that
--     match your existing auth pattern later)
--   • Audit log table for rejected submissions
--   • Export view (no auth-specific grants)
--
-- HOW THE DATA GETS READ:
--   • Supabase Dashboard → uses platform admin connection (bypasses RLS) ✓
--   • Your existing backend with service_role key (bypasses RLS) ✓
--   • Your existing API code calling the table via authenticated user JWT →
--     you'll add your own RLS policy that fits your auth model
--
-- HOW THE DATA GETS WRITTEN:
--   • Only the Edge Function (using service_role) inserts. Anon role has
--     zero direct access. This stays the same.
--
-- BEFORE RUNNING:
--   • Decide if `intake` is a good schema name for your project. If it
--     collides, find-and-replace `intake` → something specific to this
--     feature (e.g. `dg_intake` or `recruiting`).
--   • Decide if `cv-uploads` is a good bucket name. If it collides, change
--     it everywhere (this SQL + the Edge Function + the form HTML).
-- =============================================================================

-- 1. Extensions
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;

-- 2. Schema
create schema if not exists intake;

-- 3. Main candidates table
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

    -- Consent
    consent_pool        boolean  not null check (consent_pool = true),
    consent_intro       boolean  not null check (consent_intro = true),
    consent_jobcoach    boolean  not null default false,

    -- Notes
    notes               text     check (notes is null or char_length(notes) <= 1000),

    -- CV upload metadata
    cv_storage_path     text     check (cv_storage_path is null or char_length(cv_storage_path) <= 300),
    cv_original_name    text     check (cv_original_name is null or char_length(cv_original_name) <= 200),
    cv_size_bytes       integer  check (cv_size_bytes is null or cv_size_bytes between 1 and 10485760),
    cv_mime_type        text     check (cv_mime_type is null or cv_mime_type in (
                            'application/pdf',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        )),

    -- Audit / abuse
    ip_hash             text     check (ip_hash is null or char_length(ip_hash) = 64),
    user_agent_hash     text     check (user_agent_hash is null or char_length(user_agent_hash) = 64),
    turnstile_action    text     check (turnstile_action is null or char_length(turnstile_action) <= 50),

    -- Recruiter workflow fields (your app updates these)
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

-- 4. Indexes
create index if not exists candidates_submitted_at_idx on intake.candidates (submitted_at desc);
create index if not exists candidates_email_idx        on intake.candidates (email);
create index if not exists candidates_priority_idx     on intake.candidates (priority) where priority is not null;
create index if not exists candidates_stage_idx        on intake.candidates (stage)    where stage is not null;
create index if not exists candidates_desired_role_idx on intake.candidates (desired_role);

-- 5. Lock down direct API access (RLS in default-deny mode)
-- ---------------------------------------------------------------------------
-- We turn RLS ON and revoke direct privileges. NO permissive policies are
-- added — this is intentional. With RLS on and no policies:
--   • anon role          → cannot read, write, update, delete via the API
--   • authenticated role → cannot read, write, update, delete via the API
--   • service_role       → BYPASSES RLS by design (the Edge Function uses this)
--   • Supabase Dashboard → BYPASSES RLS (admin connection)
--   • Your existing app  → bypasses RLS if it uses service_role server-side
--
-- If you later need your existing app's `authenticated` users to read this
-- table via the public API, add a policy that mirrors your app's existing
-- authorization model. Example shapes (uncomment and adapt the one you use):
--
--   -- a) If your app stores admin/recruiter flags in a profiles table:
--   -- create policy "recruiters can read candidates"
--   -- on intake.candidates for select to authenticated
--   -- using ( exists (
--   --   select 1 from public.profiles
--   --   where profiles.id = auth.uid() and profiles.is_recruiter = true
--   -- ));
--
--   -- b) If your app uses a JWT claim from your existing auth setup:
--   -- create policy "recruiters can read candidates"
--   -- on intake.candidates for select to authenticated
--   -- using ( coalesce(auth.jwt() ->> 'role', '') in ('admin','recruiter') );
--
--   -- c) If your app uses Supabase's built-in role enum:
--   -- create policy "recruiters can read candidates"
--   -- on intake.candidates for select to authenticated
--   -- using ( auth.role() = 'authenticated' );  -- broad — narrow as needed
-- ---------------------------------------------------------------------------

alter table intake.candidates enable row level security;
revoke all on intake.candidates from anon, authenticated;

-- 6. Storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'cv-uploads',
    'cv-uploads',
    false,
    10485760,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS — same default-deny posture. No anon/authenticated INSERT or
-- SELECT policy. Only service_role (Edge Function) and the Dashboard can
-- touch the bucket. If your existing app needs to surface CVs to users,
-- generate signed URLs server-side from a trusted context.

-- 7. Audit / abuse log
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

-- 8. Schema usage grant (does NOT grant table privileges — RLS still gates rows)
grant usage on schema intake to anon, authenticated, service_role;

-- 9. Convenience view for exports (no role-specific grants)
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

-- =============================================================================
-- Done. Next:
--   1. Deploy the Edge Function (supabase_edge_function.ts) — unchanged.
--   2. Configure your existing app's data access:
--      • If your app reads via service_role on its server, no policy changes
--        needed; everything just works.
--      • If your app reads through the public API as `authenticated`, add ONE
--        of the policies from section 5 above that matches your auth model.
-- =============================================================================
