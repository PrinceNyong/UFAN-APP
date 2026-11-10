# Ufan by Udobong — v0.6 secure-backend starter

This is a **deployable starter**, NOT an already-deployed service or a security-certified production application. Unlike v0.5, it is designed for real Supabase Authentication, PostgreSQL persistence, row-level security and server-side points approval. It requires configuration and independent testing before real-user onboarding.

## Contents
- `index.html` — responsive interface
- `app.js` — entrepreneur, agent and administrator interfaces
- `schema.sql` — tables, RLS policies and administrator-only approval RPC
- `config.example.js` — configuration template

## Setup
1. Create a new Supabase project under Udobong's ownership. Enable email confirmation and configure allowed site URLs. Set up MFA for admin accounts and review Supabase's current security recommendations.
2. Open the Supabase SQL editor and run `schema.sql` in a fresh project. Inspect the SQL before executing. This schema is a starter, not a security audit.
3. Copy `config.example.js` to `config.js` and replace the placeholders with your project URL and **public** anon/publishable key. **Never expose a service-role/secret key** in client code.
4. Host the four web files (`index.html`, `app.js`, `config.js`) on an HTTPS static host such as Cloudflare Pages or Netlify. The application loads the Supabase JS library from `esm.sh`, so the host needs internet access. Do not use a `file://` URL for testing modules.
5. Sign up as an entrepreneur. Confirm your email if required. Create a sample business and complete the 12-question assessment.
6. To create an administrator, sign up with a separate account, find its UUID in Authentication > Users, then run the **manual administrator promotion** command at the bottom of `schema.sql` with the actual UUID. This must only be done by the project owner using the SQL editor. Agent promotion and assignment also use trusted SQL commands shown there.
7. Test with **fictional data only** until independent authorization, privacy and vulnerability testing are completed.

## Role permissions
- Entrepreneur: creates and edits own business, completes assessments, submits claims, views own points.
- Agent: views assigned businesses, assists with assessments and submits claims for assigned entrepreneurs; cannot award points.
- Admin: views and reviews claims, awards points through a server-side transaction, views audit events. Cannot self-register as admin.

## Critical acceptance tests
1. An entrepreneur must not see or modify another entrepreneur's business, assessments, claims or points.
2. An agent must not access businesses not explicitly assigned to them.
3. Neither entrepreneur nor agent may directly change a claim status or insert into the points ledger.
4. Only an administrator can execute `review_claim`, and the same claim cannot be approved twice.
5. A rejected claim can be resubmitted as a new claim; a pending/approved claim for the same task cannot be duplicated.
6. Review transactions must be atomic: if inserting the points ledger fails, approval must also fail.
7. Verify account confirmation, password reset, rate limits, secure hosting, logging, backups, recovery, admin MFA, and privacy notices before field deployment.
8. Validate input, assessment JSON shape, and enforce request limits at the backend before production. The starter does not yet implement these protections comprehensively.

## Limitations and next sprint
- No uploads of evidence documents or sensitive information; claims use text descriptions only.
- No offline sync, SMS/USSD, reward redemption, multiple businesses per entrepreneur in UI, or automated agent assignment.
- Agent approval is intentionally prohibited; only admins approve claims.
- No point award for assessment completion yet; all credited points are backed by an approved claim.
- The scoring system is a self-assessment, not a verified compliance or credit score.
- Data retention, consent, legal privacy notices and Nigerian data protection compliance must be reviewed with qualified counsel.
- Add dedicated admin/agent invitation workflows, stronger validation, test coverage, monitoring and a formal security review before real deployment.

## Pilot budget checkpoint
Using a managed backend and static hosting can reduce infrastructure spend, but setup, security reviews, support, data protection, training and community-agent costs remain. Obtain current provider quotes before committing funds.
