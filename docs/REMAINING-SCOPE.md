# Milestone and remaining scope

## What this milestone is

A runnable bilingual learning-platform demo with organized frontend/backend source and an optional AWS template. It covers the main student, instructor and owner journeys: course discovery; free enrollment; manual receipt review before paid access; lessons and progress; quizzes and self-paced completion records; moderated learner reviews; saved courses; notes; course Q&A; instructor insights; new-course publication approval; and learner reports.

This is a usable local design/source milestone, not an already-launched service or full Udemy feature parity. No deployment or spending has been performed. The preview uses shared, editable browser storage. Do not enter private information or real financial evidence.

## Before real learners or paid operations

1. Choose the intended AWS account/region and explicitly approve any deployment and its possible costs. Complete the live acceptance checklist with separate student, instructor and owner accounts. Verify Cognito, role boundaries, JWT validation, CORS, storage versions, signed playback and CloudFront. Local tests do not establish those results.
2. Add operational controls: owner MFA, upload quotas and scanning/quarantine, abuse rate limits, report escalation/response policy, data retention and account erasure, monitoring, cost alerts, backup/restore rehearsal and incident handling. Review accessibility and content policies with real users.
3. Replace bounded teaching partitions with suitable indexes, pagination and read-cost checks for the intended scale. Do not remove guards to mask scaling limits.
4. Decide the real manual-payment process and privacy/refund terms before enabling manual mode. A screenshot is evidence, not settlement confirmation. Human receiving-account verification remains necessary. There is no provider integration, refund flow or instructor payout ledger.

These are readiness gates, not authorization to execute them.

## Optional product expansion, separate from this milestone

- Published curriculum revisions with deliberate enrollment/progress/certificate migration.
- Notifications, account settings and richer owner user/content management.
- Shopping cart, coupons and a chosen payment provider with verified webhooks, ledger, refunds, revocation and payouts.
- Public certificate verification with a privacy and tamper-resistance design.
- Search at scale, richer reporting and a complete moderation appeal/audit workflow.

No implementation date or promise of complete feature parity is attached to these optional items. Preserve the current manual-payment access rule and existing learner records when extending the source.
