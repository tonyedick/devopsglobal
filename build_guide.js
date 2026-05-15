const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  TabStopType, TabStopPosition, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak
} = require('docx');

// ---------- helpers ----------
const P = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60 },
  ...opts,
  children: opts.children || [new TextRun({ text, ...(opts.run || {}) })],
});

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 300, after: 160 },
  children: [new TextRun({ text, bold: true, size: 32 })],
});

const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text, bold: true, size: 26 })],
});

const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 180, after: 90 },
  children: [new TextRun({ text, bold: true, size: 22 })],
});

const Bullet = (text, level = 0) => new Paragraph({
  numbering: { reference: "bullets", level },
  spacing: { before: 40, after: 40 },
  children: [new TextRun({ text, size: 22 })],
});

const BulletRich = (runs, level = 0) => new Paragraph({
  numbering: { reference: "bullets", level },
  spacing: { before: 40, after: 40 },
  children: runs,
});

const Numbered = (text) => new Paragraph({
  numbering: { reference: "numbers", level: 0 },
  spacing: { before: 40, after: 40 },
  children: [new TextRun({ text, size: 22 })],
});

const Body = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text, size: 22, ...(opts.run || {}) })],
});

const Quote = (text) => new Paragraph({
  spacing: { before: 80, after: 80 },
  indent: { left: 360 },
  children: [new TextRun({ text: `"${text}"`, italics: true, size: 22 })],
});

const Label = (label, value) => new Paragraph({
  spacing: { before: 40, after: 40 },
  children: [
    new TextRun({ text: `${label}: `, bold: true, size: 22 }),
    new TextRun({ text: value, size: 22 }),
  ],
});

const Divider = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 6 } },
  spacing: { before: 80, after: 80 },
  children: [new TextRun({ text: "" })],
});

// ---------- role question banks ----------

const devopsBank = [
  H2("DevOps Question Bank (Pipeline Standard)"),
  Body("Use these for any DevOps / Cloud / SRE role. Drill into each answer — chase the trade-off, the metric, the failure mode. Document responses in the Tracker."),

  H3("Kubernetes (Core Focus)"),
  Numbered("You have a Kubernetes cluster where several pods are going into CrashLoopBackOff. How would you analyse this step by step?"),
  Numbered("How would you set up a Kubernetes cluster to be production-ready? Name specific measures."),
  Numbered("What concrete security measures have you implemented in Kubernetes?"),
  Numbered("How do you handle secrets management in Kubernetes?"),

  H3("Terraform / Infrastructure as Code"),
  Numbered("How do you structure a larger Terraform project across multiple environments (dev, staging, production)?"),
  Numbered("Have you ever faced an issue with Terraform state or faulty provisioning? What happened and how did you resolve it?"),

  H3("CI/CD & Deployments"),
  Numbered("Describe a CI/CD pipeline you built yourself — tools, process, deployment strategy."),
  Numbered("How do you ensure a deployment does not cause downtime? Which strategies do you use (rollback, blue/green, canary)?"),

  H3("Cloud & Architecture"),
  Numbered("Tell us about a project where you built or migrated infrastructure in AWS or another cloud. What was your exact responsibility?"),
  Numbered("When would you choose AWS over Azure or GCP and why?"),

  H3("Problem-Solving & Ownership (Critical)"),
  Numbered("What was the most complex technical problem you solved in the last 12 months? Walk us through your approach."),
  Numbered("Which system or project were you fully responsible for from setup to operation?"),

  H3("Remote Work & Self-Management"),
  Numbered("How do you structure your work in a remote environment?"),
  Numbered("What do you do when you get completely stuck on a problem?"),
];

const frontendBank = [
  H2("Frontend Question Bank (Pipeline Standard)"),
  Body("Use these for React / Next / TypeScript frontend roles. Push for concrete examples, real bugs, and trade-offs — not vocabulary."),

  H3("Architecture & State (Core Focus)"),
  Numbered("Walk me through component architecture on a recent project. How do you decide what is a shared component vs a page-level component vs a feature module?"),
  Numbered("State management: when do you reach for component state, when for Context, when for Redux/Zustand/Jotai? Give a recent example where you got it wrong and what you learned."),
  Numbered("How do you handle complex form state — multi-step flows, cross-field validation, async dependencies? Walk through a real architecture."),
  Numbered("Performance: tell me about a real bottleneck you diagnosed and fixed. What tools, what root cause, what fix?"),

  H3("React / Next.js / TypeScript Depth"),
  Numbered("SSR vs SSG vs CSR vs ISR — give a real example of when you chose each and why."),
  Numbered("TypeScript: show me a generic or conditional type you have written in production, and what problem it solved."),
  Numbered("Hydration mismatches — have you ever shipped one? How did you find it and what was the underlying cause?"),

  H3("Quality, Testing, Accessibility"),
  Numbered("What is your testing approach — unit, integration, e2e? What would you test in a sign-up flow?"),
  Numbered("Accessibility: what concrete a11y measures have you actually implemented in production (not theory)?"),

  H3("Cross-Functional & Delivery"),
  Numbered("Walk me through a time you pushed back on a design or product decision. What was the technical reasoning and how did you communicate it?"),
  Numbered("CI/CD on the frontend — preview deploys, environment variables, feature flags. How is your team set up?"),

  H3("Problem-Solving & Ownership"),
  Numbered("Most complex technical problem in the last 12 months — full walkthrough."),
  Numbered("A frontend project you owned end-to-end — setup to production."),

  H3("Remote Work & Self-Management"),
  Numbered("How do you structure your work in a remote environment?"),
  Numbered("What do you do when you get completely stuck on a problem?"),
];

const fullstackBank = [
  H2("Fullstack Question Bank (Pipeline Standard)"),
  Body("Use these for Fullstack roles. The bar is real backend depth, not just consuming an API. If backend answers stay shallow, reframe to Senior Frontend."),

  H3("Backend Depth (Critical for the Fullstack Claim)"),
  Numbered("Walk me through a recent API you designed — endpoints, auth, data flow. Why those choices?"),
  Numbered("Database modelling: design a schema live for a domain I will give you (e.g., orders, customers, line items, payments). What indexes, what constraints, what trade-offs?"),
  Numbered("Tell me about a database performance problem you fixed — N+1, missing index, lock contention. How did you diagnose and resolve it?"),
  Numbered("How do you handle long-running or async work — queues, workers, retries, idempotency? Give a real example."),

  H3("Backend Architecture"),
  Numbered("When do you reach for monolith vs services vs serverless? Give a real decision you made and why."),
  Numbered("Auth & authorisation: walk me through a session or token lifecycle in a system you have shipped."),
  Numbered("Caching: what have you cached, where, and what was your invalidation rule?"),

  H3("Frontend (Still Required for Fullstack)"),
  Numbered("Component architecture and state management — give a real example of getting it wrong and what you learned."),
  Numbered("A frontend performance bottleneck — diagnosis, cause, fix."),

  H3("Cross-Stack & Contracts"),
  Numbered("Walk me through a feature you shipped end-to-end — schema, API, frontend, deployment. What was hardest?"),
  Numbered("How do you contract between frontend and backend — OpenAPI, GraphQL, tRPC, hand-rolled types? What broke when you got it wrong?"),

  H3("CI/CD & Cloud"),
  Numbered("Describe a deployment pipeline you have built or worked in. How do you ship safely?"),
  Numbered("Cloud: which services have you used in production (not just touched)? What was your exact responsibility?"),

  H3("Problem-Solving & Ownership"),
  Numbered("Most complex problem solved in the last 12 months — full walkthrough."),
  Numbered("A project you owned from setup to production."),

  H3("Remote Work & Self-Management"),
  Numbered("How do you structure your work remotely?"),
  Numbered("What do you do when you get completely stuck?"),
];

// ---------- per-candidate guides ----------

const candidateGuide = ({
  tier, name, role, snapshot, opening, confirmStrengths, drillRedFlags,
  pickQuestions, commercials, scoringFocus, nextStep
}) => [
  H2(`${tier} · ${name}`),
  Label("Role under review", role),
  Label("Snapshot", snapshot),

  H3("Opening question (set the tone)"),
  Quote(opening),

  H3("Strengths to confirm (let him talk, listen for specifics)"),
  ...confirmStrengths.map(s => Bullet(s)),

  H3("Red flags / drill points (don't soften, ask plainly)"),
  ...drillRedFlags.map(s => Bullet(s)),

  H3("From the question bank — focus this call on these"),
  ...pickQuestions.map(s => Bullet(s)),

  H3("Commercial & logistics (close the call with this)"),
  ...commercials.map(s => Bullet(s)),

  H3("Scoring focus (what determines progression)"),
  ...scoringFocus.map(s => Bullet(s)),

  H3("Recommended next step"),
  Body(nextStep),

  Divider(),
];

const samuel = candidateGuide({
  tier: "A",
  name: "Samuel Opeyemi Oni",
  role: "DevOps Engineer",
  snapshot: "3+ yrs (CV) / 4 (form) · Rate: NGN 2,000,000/month · Employed, 2 wks notice · Remote + relocation",
  opening: "Walk me through the Secure Three-Tier Fintech on EKS project — your specific contribution to the WAF and IAM pod identity work, and what trade-offs you made.",
  confirmStrengths: [
    "Multi-cloud Terraform / K8s / ArgoCD alignment — listen for whether ArgoCD was production or lab-scale.",
    "KCNA certified + modern toolchain (Helm, Istio, Argo, Flux) — confirm depth on at least two.",
    "Concrete shipped project (Fintech on EKS, WAF, IAM pod identity, Terraform/Helm) — push for the story behind the metrics.",
  ],
  drillRedFlags: [
    "Every CV bullet carries an aggressive % metric. Pick ONE and ask for the story, the baseline, the measurement method.",
    "Form lists Azure/GCP — confirm whether real production work or coursework. AWS is likely the real-only stack.",
    "Notice discrepancy: form 4 yrs vs CV 3+ yrs. Ask him to reconcile.",
  ],
  pickQuestions: [
    "Bank Q1 (CrashLoopBackOff) — quick diagnostic baseline.",
    "Bank Q3 (K8s security measures) — should be strong given KCNA; drill into pod security standards, network policies, image scanning.",
    "Bank Q5 (Terraform structure across envs) — does he use workspaces, separate state files, or a wrapper like Terragrunt?",
    "Bank Q9 (cloud migration project) — direct him to the EKS Fintech project specifically.",
    "Bank Q11 (most complex problem in 12 months) — the integrity check on his metrics.",
  ],
  commercials: [
    "Reconfirm rate (NGN 2M/month) and openness to USD/EUR contracts.",
    "Notice period (2 weeks) — solid; verify whether current employer has a non-compete.",
    "Relocation: which regions, family considerations, visa readiness.",
  ],
  scoringFocus: [
    "Can he defend at least 2 of his CV % metrics with concrete detail?",
    "Does the Azure/GCP claim survive depth questions, or is it AWS-only?",
    "Is the ArgoCD / Istio / Flux experience production, or pet-project?",
  ],
  nextStep: "If Stage 1 confirms depth on AWS + Terraform + Argo, hand to Peter for Stage 2 (K8s/Terraform depth + system-design probe). Then Jobcoach. Quality over quantity — only forward when verified.",
});

const rasaq = candidateGuide({
  tier: "A",
  name: "Rasaq Ganiyu Mayowa",
  role: "Frontend Engineer",
  snapshot: "5 yrs · Rate: EUR 10-15/hr (under-market) · Open · Remote + relocation · Currently contracted to UN/WFP Rome",
  opening: "Walk me through the form workflows and validation architecture you built for WFP — what were the trickiest cross-field calculation cases, and how did you handle the business-logic layer?",
  confirmStrengths: [
    "Currently contracted to UN/WFP building the School Meals Coalition Database — international delivery already proven.",
    "5+ years progressive frontend, including Team Lead role at Loyalty Solutions.",
    "Solid React / Next / TypeScript depth, plus a Math degree analytical edge. Live blog and active GitHub.",
  ],
  drillRedFlags: [
    "Rate is far below market (EUR 10-15/hr vs realistic EUR 40-60/hr for UN-affiliated senior FE). Why? Confidence, geography, or has he simply never been told?",
    "Team Lead at Loyalty Solutions — did he hire, fire, set OKRs, run 1:1s — or just code review and unblock?",
    "Form honestly says backend = None. Don't push him into Fullstack framing.",
  ],
  pickQuestions: [
    "Bank Q1 (component architecture) — listen for how he separated shared vs feature-local on the WFP build.",
    "Bank Q3 (complex form state, cross-field validation) — direct match for the WFP work, opening question feeds straight here.",
    "Bank Q4 (performance bottleneck) — get a real story, not React.memo theory.",
    "Bank Q6 (TypeScript generics / conditional types) — should be solid for a 5-year FE; if he stumbles, downgrade depth assessment.",
    "Bank Q10 (pushing back on design/product) — proxy for his actual leadership at Loyalty Solutions.",
  ],
  commercials: [
    "Coach gently on rate expectations: current UN/WFP plus 5 yrs = EUR 40-60/hr is the band. Don't quote a number — guide him to reframe.",
    "Confirm contract end date with WFP and how much overlap is possible.",
    "Relocation: he is already in Rome (or working with them) — clarify physical location and EU work authorisation.",
  ],
  scoringFocus: [
    "Does the WFP architecture story show real ownership of business logic, or just UI implementation?",
    "Can he articulate a TS / state-management trade-off without prompts?",
    "Will he be coachable on rate, or does he undersell himself in the call?",
  ],
  nextStep: "Schedule Stage 1; gently reframe his rate band on the call. If commercials adjust to market, route to Jobcoach. Strong candidate — protect him from himself on pricing.",
});

const akhigbe = candidateGuide({
  tier: "A",
  name: "Akhigbe Holyworth Ebosele",
  role: "Fullstack (claimed) — likely Senior Frontend",
  snapshot: "4 yrs · Rate: USD 2,500/month (under-market) · Open, immediately available · Remote + relocation · Currently Senior FE @ Interswitch",
  opening: "Your CV shows pure frontend — web and mobile. What is your real production backend work, vs. what's adjacent to it? Be specific about the Node or Nest you have actually shipped.",
  confirmStrengths: [
    "Senior Frontend @ Interswitch since Jan 2025 — premium West-African fintech, strong employer signal.",
    "Sabivest shipped to both App Store and Play Store — real release experience including EAS.",
    "React / Next / RN with concrete metrics (40% release-friction reduction, 40% engagement uplift). Babcock CS, GPA 4.0/5.0.",
  ],
  drillRedFlags: [
    "Form says Fullstack but CV is purely frontend (web + mobile). Reframe ruthlessly unless backend depth surfaces.",
    "Node / NestJS listed but no role on the CV used them in production. Where, what, how long?",
    "Rate of USD 2,500/month is low for a Senior at Interswitch — band is USD 3,500-5,000+. Why so low?",
  ],
  pickQuestions: [
    "Fullstack Bank Q1 (API he designed) — if shallow within 2 minutes, switch to Frontend Bank.",
    "Fullstack Bank Q2 (live DB schema design) — quickest way to confirm or kill the Fullstack claim.",
    "Frontend Bank Q1 (component architecture) — Sabivest is the obvious anchor.",
    "Frontend Bank Q4 (performance bottleneck) — push for the actual diagnosis behind the 40% engagement number.",
    "Frontend Bank Q12 (most complex problem in 12 months) — the integrity check.",
  ],
  commercials: [
    "Confirm rate, target range, and whether he is open to EUR or USD contracts.",
    "Coach gently on rate — at his level, USD 3,500-5,000/month is the band.",
    "Notice period: immediately available — confirm Interswitch exit is clean (no garden leave, no return-of-bonus).",
  ],
  scoringFocus: [
    "Backend test: does ANY production Node/Nest work hold up under 3 follow-ups?",
    "If reframed as Senior Frontend, does the Sabivest end-to-end story land cleanly?",
    "Will he accept the Senior Frontend reframe without losing motivation?",
  ],
  nextStep: "Stage 1 with the explicit reframe in mind. If reframed as Senior Frontend, he is a clean A → Jobcoach. If he insists on Fullstack but cannot defend backend, hold or downgrade to B.",
});

const albert = candidateGuide({
  tier: "B",
  name: "Albert Byrone",
  role: "Fullstack Engineer",
  snapshot: "4 yrs · Rate: USD 35/hr · Immediately available · Remote only · Andela Kenya alumnus (2020)",
  opening: "Walk me through Pessafy — your specific contribution to backend vs. frontend, and one trade-off you actually had to make.",
  confirmStrengths: [
    "Real production work spanning Python/Django/FastAPI + React/Next/TS across multiple Kenyan startups.",
    "Genuine payment-systems experience (Daraja, Jenga, Arronax CapiCollect, e-wallet) — rare and useful.",
    "Andela Kenya alumnus (2020) — pre-vetted education path.",
  ],
  drillRedFlags: [
    "Three overlapping roles in 2024 (Native X May-Jul, Trillionchip May-Dec, Guzzer May-Dec). Sequential, parallel-freelance, or contract-stacked? Ask plainly.",
    "Short tenures pattern (Arronax 3 months, Trillionchip 2020 = 9 months, etc.). Story or pattern?",
    "Cloud listed as basics (EC2/S3/RDS + CI/CD basics). Is AWS real or surface?",
    "Remote-only (no relocation) — confirm but no need to push.",
  ],
  pickQuestions: [
    "Fullstack Bank Q1 (API he designed) — direct him to a payments-flow example.",
    "Fullstack Bank Q3 (DB performance problem) — payment systems should produce one.",
    "Fullstack Bank Q4 (async work — queues, retries, idempotency) — payments + idempotency is a clean test.",
    "Fullstack Bank Q11 (end-to-end feature: schema → API → FE → deploy) — opens the Pessafy story.",
    "Fullstack Bank Q14 (most complex problem in 12 months) — also gives him room to address the 2024 overlap.",
    "Bonus: ask directly about the 2024 overlap. Tone neutral, not accusatory.",
  ],
  commercials: [
    "Confirm USD 35/hr is monthly-equivalent expectation (~USD 5,600/month at full-time).",
    "Remote only — confirm no future relocation appetite (affects client matching).",
    "Confirm no current commitments that would create the 2024-style overlap again.",
  ],
  scoringFocus: [
    "Does the 2024 overlap have a clean, documented explanation (contracts, end dates, evidence)?",
    "Is the payments work real (Daraja API depth, idempotency, reconciliation) or just integration?",
    "Cloud: does he reach beyond EC2/S3/RDS into anything operational?",
  ],
  nextStep: "Schedule Stage 1 with overlap question front-and-centre. If 2024 overlap explains cleanly AND payments depth is real, move to Stage 2. If overlap is shaky, hold and ask for written timeline before progressing.",
});

const chris = candidateGuide({
  tier: "B",
  name: "Chukwubuikem Christopher Ekpe",
  role: "DevOps Engineer",
  snapshot: "2+ yrs (CV) / 3 (form) · Rate: NGN 500,000/month · Employed, 4 wks notice · Remote + relocation",
  opening: "Your current EKEDC role is IT support, not DevOps. What DevOps work have you been doing in the last 6 months — open source, side projects, or on the side at EKEDC?",
  confirmStrengths: [
    "Five real certifications (KCNA, AWS CCP, AWS SAA, OCI DevOps Pro, ISO/IEC 27001 Lead Auditor) — heavy cert profile.",
    "Real Onafriq fintech DevOps work (CloudWatch + SNS + PagerDuty + Amplify).",
    "Multi-cloud breadth on paper (AWS / Azure / GCP / OCI).",
  ],
  drillRedFlags: [
    "Current EKEDC role (Sep 2025-Present) is IT support — laptop imaging, Cisco switches, Fortinet, MFA setup. Not DevOps.",
    "Real hands-on DevOps tenure is ~9 months total (3 mo HNG + 6 mo Onafriq).",
    "Form claims 3 yrs vs CV 2+. Reconcile.",
    "Multi-cloud claim is suspicious for someone with 9 months production. Probe depth.",
  ],
  pickQuestions: [
    "Bank Q1 (CrashLoopBackOff) — basic diagnostic confidence check.",
    "Bank Q3 (K8s security) — KCNA should support this; if it doesn't, the cert is paper.",
    "Bank Q7 (CI/CD pipeline he built himself) — direct him to Onafriq specifically.",
    "Bank Q9 (cloud project, exact responsibility) — listen for ownership vs assistance.",
    "Bank Q12 (system fully responsible for) — likely thin, but the answer is diagnostic.",
    "Direct: \"How are you keeping DevOps muscle alive in an IT-support role? Show me a recent repo, lab, or write-up.\"",
  ],
  commercials: [
    "Confirm NGN 500,000/month — relatively low, ask about USD/EUR expectation.",
    "Notice period 4 weeks — confirm and check non-compete.",
    "Relocation: target regions and visa status.",
  ],
  scoringFocus: [
    "Does the 6-month gap from real DevOps practice show? Has he kept skills alive via labs, side projects, or community work?",
    "Do the 5 certifications translate into real implementation, or are they paper-only?",
    "Is the multi-cloud claim honest or aspirational?",
  ],
  nextStep: "Schedule Stage 1. Peter second opinion is essential given the 6-month DevOps gap + heavy cert/light experience profile. If Peter is unconvinced on real depth, hold at B and revisit in 3 months with evidence of ongoing practice.",
});

// ---------- assembly ----------

const titlePage = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200 },
    children: [new TextRun({ text: "Interview Discussion Guide", bold: true, size: 48 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: "DevOps.global Tech Recruiter Pipeline", size: 28 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 600 },
    children: [new TextRun({ text: "Prepared for Tonye · May 2026", italics: true, size: 22 })],
  }),
  new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: "How to use this document", bold: true, size: 24 })],
  }),
  Body("Part 1 contains role-specific question banks — DevOps, Frontend, Fullstack. Use them as the standard pipeline going forward. Drill into every answer: chase the trade-off, the metric, the failure mode. If the candidate cannot defend a claim within two follow-ups, mark it Unverified."),
  Body("Part 2 contains personalised guides for the five candidates currently scheduled. Each guide flags strengths to confirm, red flags to drill, the questions from the bank to focus on, and the scoring criteria for progression."),
  Body("Non-negotiables: quality over quantity, no job/salary promises, verified before forwarded, document or it didn't happen."),
  new Paragraph({ children: [new PageBreak()] }),
];

const part1 = [
  H1("Part 1 · Role-Specific Question Banks"),
  Body("Standard question sets for every interview going forward. Adapt order to the candidate; do not skip the Problem-Solving & Ownership and Remote Work sections — they are the integrity check."),
  ...devopsBank,
  new Paragraph({ children: [new PageBreak()] }),
  ...frontendBank,
  new Paragraph({ children: [new PageBreak()] }),
  ...fullstackBank,
  new Paragraph({ children: [new PageBreak()] }),
];

const part2 = [
  H1("Part 2 · Per-Candidate Discussion Guides"),
  Body("Five scheduled candidates. Open with the suggested question, run the bank picks, close with commercials. Log every answer in the Tracker."),
  ...samuel,
  ...rasaq,
  ...akhigbe,
  new Paragraph({ children: [new PageBreak()] }),
  ...albert,
  ...chris,
];

const closing = [
  H1("Closing Checklist (run before forwarding any candidate)"),
  Bullet("Recruiting Check logged in Tracker with date and outcome."),
  Bullet("Technical Fit Review logged with verified strengths AND verified gaps."),
  Bullet("Peter second-opinion logged where flagged (DevOps + ambiguous Fullstack)."),
  Bullet("Commercial expectation confirmed in writing (rate, notice, relocation)."),
  Bullet("No job-title or salary promise made — re-read your notes for slippage."),
  Bullet("Jobcoach referral only after all of the above is green."),
];

// ---------- build ----------

const doc = new Document({
  creator: "Tonye",
  title: "Interview Discussion Guide — DevOps.global",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1F3864" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "1F3864" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ] },
      { reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "DevOps.global · Interview Discussion Guide", size: 18, color: "808080" })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 18, color: "808080" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" }),
          ],
        })],
      }),
    },
    children: [
      ...titlePage,
      ...part1,
      ...part2,
      ...closing,
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/practical-pensive-newton/mnt/outputs/Interview_Discussion_Guide_DevOps_global.docx", buffer);
  console.log("Wrote Interview_Discussion_Guide_DevOps_global.docx");
});
