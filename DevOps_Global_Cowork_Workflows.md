# DevOps.global — Cowork Workflows

> Paste-and-go prompts for Cowork. Each workflow is a self-contained prompt you copy into chat. Drop in the candidate input (CV text, LinkedIn URL, form submission) and Cowork returns a structured output you can paste directly into the Tracker, an email, or a community channel.

---

## How to use this document

1. Open Cowork in a new chat.
2. Find the workflow you need below.
3. Copy the **entire prompt block** (everything between the dashed lines).
4. Replace the `<<< … >>>` placeholders with the candidate's information.
5. Send. Cowork returns a structured output.

Tip: pin this doc as a Knowledge file in Cowork so you can ask things like *"use the CV extractor on this CV"* and Cowork will pull the right prompt automatically.

---

## Workflow 1 — CV → Tracker row

**When to use it:** You have a CV (PDF, doc, or pasted text) and want it as a structured row to paste into the Candidate Tracker.

**Copy this prompt block:**

```
You are helping me, Tonye, a Technical Recruiter at DevOps.global. I am going to give
you a candidate CV. Your job is to extract structured data that I can paste directly
into my Candidate Tracker (Excel).

Output ONLY a markdown table with two columns: Field, Value. Use exactly these field
names in this exact order. If a field is not in the CV, write "(not in CV)" — do not
guess. Be concise. Use the candidate's own wording where possible.

Fields:
- Name
- Email
- Phone
- LinkedIn
- Country / City
- Time Zone (infer from country if not stated)
- Current Role
- Desired Role (infer from CV focus area: DevOps Engineer / Cloud Engineer / SRE /
  Platform Engineer / Kubernetes Engineer / Terraform Engineer / Frontend Engineer /
  Backend Engineer / Full Stack Engineer / Core Team Member)
- Years Exp. (estimate from earliest professional role)
- Main Skills (top 3-5 most prominent, comma-separated)
- Frontend Skills (React/Angular/Vue/TS etc., or "(n/a)")
- Backend Skills (Node/Java/Python/Go/.NET etc., or "(n/a)")
- DevOps/Cloud Skills (AWS/Azure/GCP/K8s/Terraform/CI-CD etc., or "(n/a)")
- Languages (spoken languages, with level if stated)
- Availability (notice period or earliest start, "(not in CV)" if absent)
- Salary / Rate ("(not in CV)" if absent)
- Work Model (Remote / Hybrid / Onsite if stated, "(not in CV)" otherwise)
- Current Status (Employed / Freelancing / etc.)
- Most-Proud Project (one sentence summary)

After the table, add a section "TONYE'S NOTES" with:
- 3 things that look genuinely strong (with specifics from the CV)
- 2 things to verify on the Recruiting Check call (claims that look thin or vague)
- One question you'd ask first on the call
- Suggested initial Priority guess (A / B / C) and one-line reasoning

Here is the CV:

<<< PASTE THE CV TEXT HERE >>>
```

---

## Workflow 2 — Bulk CV processing

**When to use it:** Kerstin forwards you a batch of applicants. You want to process them quickly without doing 20 manual extractions.

**Approach:** Drop the CVs into a folder, connect the folder to Cowork via `request_cowork_directory`, then use this prompt:

```
I have a folder of candidate CVs at the connected directory. For each CV file:

1. Read it.
2. Apply the CV → Tracker row workflow (same field list as Workflow 1).
3. Save the structured output to a single CSV file called
   "batch_extraction_<<DATE>>.csv" in the same folder, with one row per CV and
   columns matching the Tracker spec.
4. Also produce a short markdown summary called "batch_summary_<<DATE>>.md"
   listing each candidate with their suggested initial Priority (A/B/C) and
   one-line reasoning, sorted from A to C.

Be honest about Priority. Do not pad A. Anyone with vague claims or unverifiable
tech skills is at most a B.
```

---

## Workflow 3 — Outreach personalizer

**When to use it:** You're about to send the §5.1 or §5.2 outreach template and want it tailored to the candidate's actual experience instead of sending the generic version.

**Copy this prompt block:**

```
Personalize a DevOps.global outreach message. Use the candidate context below to
write a one-sentence personalized hook, then use the rest of my template unchanged.

Rules:
- The hook must reference something specific and verifiable from their CV/LinkedIn
  (a project, a skill they clearly use, a community contribution). Do not flatter
  generically. No "impressive background" or "stood out".
- Hook is ONE sentence, max 25 words.
- Do not change anything else in the template.
- Do not promise jobs, salaries, or specific clients.
- Tone: warm and professional. We are a premium talent agency.

Candidate context:
<<< PASTE CV TEXT, LINKEDIN URL, OR A SHORT BIO HERE >>>

Channel: <<< EMAIL / LINKEDIN_DM / SLACK_DM / DISCORD_DM >>>

Template to personalize:
<<< PASTE ONE OF THESE: §5.1 First contact (warm) / §5.2 First contact (cold) /
    §5.3 Follow-up #1 / §5.4 Follow-up #2 — from the playbook >>>

Return:
1. The personalized hook on its own line (so I can see it)
2. The full message with the hook inserted, ready to paste
```

---

## Workflow 4 — Stage 2 technical question generator

**When to use it:** You're about to run a Technical Assessment (Stage 2). The cheat sheet in the playbook gives you generic probes; this workflow tailors them to the specific candidate so the call sounds informed.

**Copy this prompt block:**

```
Generate 8 technical assessment questions tailored to this candidate, for a
DevOps.global Stage 2 Technical Assessment. I am Tonye, a recruiter with a tech
background — questions should be deep enough to separate real from fake, but not
so deep that I cannot judge the answer myself.

Mix:
- 3 questions that probe their CLAIMED top skills (look for production depth,
  trade-offs, decisions they made, not textbook knowledge)
- 2 questions about their most-proud project (force them to be specific about
  their own contribution vs the team's)
- 2 questions that test a related-but-adjacent skill (do they understand the
  ecosystem or only the buzzword?)
- 1 open-ended question that lets a strong candidate shine ("walk me through…")

For each question, add a one-line "good answer looks like…" so I know what to
listen for.

End with a short "RED FLAGS TO WATCH FOR" section listing 2-3 things in this
specific CV that I should probe carefully.

Candidate CV / profile:
<<< PASTE CV TEXT HERE >>>

Target role for the assessment: <<< e.g. Senior DevOps Engineer >>>
```

---

## Workflow 5 — Stage 1 + Stage 2 → A/B/C decision draft

**When to use it:** Right after a Recruiting Check or Technical Assessment, before you write your decision into the Tracker.

**Copy this prompt block:**

```
Help me write up an honest A/B/C decision for this candidate using the
DevOps.global rubric. I'll give you my call notes; you give me back a structured
decision I can paste into the Tracker.

A / B / C definitions:
- A: pool-ready and Jobcoach-ready. All Stage 1 dimensions strong (no 1s).
     Stage 2 shows specific, defensible answers in 3+ areas. English ≥ B2 with
     clear communication. Realistic salary. Availability fits. Consent given.
- B: pool-worthy but with one ambiguous dimension (salary / availability /
     English / work model / one Stage 2 gap). Park with a specific clarification
     question.
- C: not currently suitable. Skills don't match focus areas, communication or
     professionalism flags, unrealistic salary AND inflexible, not open to
     remote / international / Jobcoach prep, or CV/conversation inconsistencies.

When in doubt, B beats A. Send a clean B over a forced A.

Return:
1. PRIORITY: A or B or C (single letter)
2. RECOMMENDATION: client-ready / talent pool / not suitable / open
3. RATIONALE: 2-3 sentences referencing the candidate's actual answers
4. NEXT STEP: a specific action + a target date (relative is fine, e.g.
   "Send Jobcoach handover by Friday")
5. JOBCOACH FLAGS (if A): 2-3 things Chinedu should pay attention to
6. PETER FLAG: Yes/No + one-line reason

My call notes:
<<< PASTE YOUR CALL NOTES HERE >>>
```

---

## Workflow 6 — Jobcoach handover email

**When to use it:** Stage 2 passed → ready to hand the candidate to Chinedu.

**Copy this prompt block:**

```
Draft a Jobcoach handover email to Chinedu at DevOps.global, based on my notes
about this candidate. Use the playbook §10 template format. Keep it short and
specific. Be honest about risks — do not oversell.

Output the full email, ready to copy and send. Subject line included.

Candidate info / call notes:
<<< PASTE NOTES HERE >>>
```

---

## Workflow 7 — Peter second-opinion request

**When to use it:** A complex DevOps/Cloud/K8s/Terraform profile where you want a senior gut check.

**Copy this prompt block:**

```
Draft a second-opinion request to Peter at DevOps.global, based on my notes
about this candidate. Use the playbook §9 template format.

Must include:
- Stage 1 result (pass/fail + brief scoring summary)
- My Stage 2 read in one paragraph — what looks strong, what I want validated
- One specific question I want Peter to answer
- Urgency level + why

Keep it short. Peter is senior and busy. Do not waste his time confirming things
that aren't ambiguous.

Candidate info / call notes:
<<< PASTE NOTES HERE >>>
```

---

## Workflow 8 — Friday weekly overview drafter

**When to use it:** Friday afternoon. You're about to write the weekly email to Kerstin.

**Copy this prompt block:**

```
Draft my weekly recruiting overview email to Kerstin at DevOps.global, using
the playbook §11 template.

Numbers (this week):
- Candidates reviewed: <<< X >>>
- A candidates identified: <<< X >>>
- B candidates identified: <<< X >>>
- Not suitable: <<< X >>>
- Recruiting Checks completed: <<< X >>>
- Technical Assessments completed: <<< X >>>
- Ready to move to Chinedu: <<< X >>>
- Peter second opinions requested: <<< X >>>
- Added to talent pool (A + B): <<< X >>>

Strongest roles in pool this week: <<< e.g. DevOps Engineer (3), Backend (2) >>>

Blockers / questions I have for Kerstin: <<< type freely or write "none" >>>

Plan for next week: <<< top 2-3 priorities >>>

Tone: short, honest, professional. If a number missed target, name it and
explain why in one line. Quality beats padding.

Return the full email, ready to send. Subject line included.
```

---

## Workflow 9 — Community post writer (Andela / Slack / Discord)

**When to use it:** Posting in a tech community channel about an opportunity or about DevOps.global generally.

**Copy this prompt block:**

```
Write a community post for me. I am Tonye, Tech Recruiter at DevOps.global, a
premium talent agency for verified tech talent (Frontend, Backend, DevOps,
Cloud).

Audience: <<< e.g. Reactiflux Discord (frontend devs), Kubernetes Slack
(DevOps/SRE), Andela community channel #devops, She Code Africa Slack >>>

Post type: <<< OPPORTUNITY / INTRODUCTION / ENGAGEMENT (e.g. asking a question)
            / RE_ENGAGEMENT (we have new roles coming) >>>

Tone signal: << e.g. casual + friendly / professional + concise / technical >>>

Key info to include:
- We are NOT collecting random CVs; we run an internal verification + prep
  process before any client introduction
- Remote-first / international opportunities
- Specific focus areas: <<< e.g. Senior DevOps with K8s, Junior Frontend with
  React, ... >>>

Constraints:
- No salary promises, no client names, no job guarantees
- Mention "talent pool" framing
- Include a clear single call-to-action (DM me, fill the intake form, etc.)
- Length: <<< short (3-5 sentences) / medium (paragraph + bullets) >>>

Also produce a one-line follow-up reply I can pin under the post that
anticipates the most common "is this legit?" question.
```

---

## Workflow 10 — Daily morning brief

**When to use it:** Every morning at 7:30 (also automated as a Cowork scheduled task — see Workflow 11).

**Copy this prompt block:**

```
Give me my morning brief as a DevOps.global recruiter. Connect to my Tracker
file (DevOps_Global_Candidate_Tracker.xlsx) and produce:

1. TODAY'S PRIORITY ACTIONS — candidates whose "Next Step" date is today or
   overdue. Format: name, stage, action, days overdue (if any).
2. AWAITING REPLY — outreach sent more than 3 days ago with no reply. Suggest
   which to follow up with today.
3. STUCK IN STAGE — candidates in Stage 1 for over 7 days or Stage 2 for over
   5 days. These are at risk of going cold.
4. THIS WEEK SO FAR — Reviewed, A+B added, vs the weekly targets at 20 hrs.
5. ONE THING — the single most important action I should take this morning,
   based on what's overdue or about to go cold.

Keep it short. Bullet points. I read this on my phone with coffee.
```

---

## Workflow 11 — Mid-week pipeline health check

**When to use it:** Wednesday lunch — quick sanity check that the week is on track.

**Copy this prompt block:**

```
Wednesday pipeline health check for DevOps.global. Look at my Tracker
(DevOps_Global_Candidate_Tracker.xlsx) and answer:

1. ON TRACK? — Compared to my weekly targets at 20 hrs (reviewed: 40-80,
   A+B added: 10-20, Rec Checks: 6-12, Tech Assess: 6-12), am I on track for
   the week as of Wednesday lunch?
2. AT-RISK CANDIDATES — Anyone in Stage 1 for >7 days or Stage 2 for >5 days.
3. THURSDAY/FRIDAY PLAN — Based on the gap to target, what should I prioritize
   over the next 48 hours?
4. EARLY WEEKLY-OVERVIEW DRAFT — Quick early version of the numbers I'll send
   Kerstin on Friday so I can flag any concerns to her now if needed.

Be direct. If I'm behind, say so.
```

---

## Workflow 12 — Channel performance review

**When to use it:** Every 2 weeks. Decide which sourcing channels deserve more time.

**Copy this prompt block:**

```
Review my channel performance for DevOps.global recruiting. Use the Channels
sheet of my Tracker (DevOps_Global_Candidate_Tracker.xlsx) and the Outreach
Log to answer:

1. Top 3 channels by A+B candidates produced (last 2 weeks).
2. Channels with the worst reply rate — should I drop or change my approach?
3. Channels with high reply rate but low A+B conversion — am I attracting the
   wrong audience there?
4. Recommendation: where should I redirect next week's sourcing time?

Be opinionated. If a channel isn't working, say so.
```

---

## Appendix — How these connect to your scheduled tasks

When you tell Cowork to schedule a task, the scheduled task uses the same prompts
above. The scheduled task wrapper just runs the prompt automatically at the
right time. So if you ever want to tune what your morning brief tells you, edit
Workflow 10 above and re-schedule.
