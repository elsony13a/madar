# Security model and limits

## Implemented in the AWS backend source

- Cognito authorization-code sign-in through `oidc-client-ts` with PKCE. Public app client, no client secret, no password collected by Madar.
- Tokens are kept in sessionStorage, not the permanent demo localStorage. No tokens or credentials are logged by the backend.
- HTTP API JWT authorizer checks issuer, client audience and `openid` scope. Lambda separately verifies the access token, its signature, expiry, pool, client and scope with `aws-jwt-verify`. No trust in an arbitrary decoded JWT or request `userId`.
- Student identity comes from verified `sub`. Only student/instructor can be chosen as a profile role. Admin requires the verified Cognito `MadarAdmins` group. Frontend navigation is not the authorization boundary.
- Instructor lesson/quiz writes are restricted to the instructor's own drafts. New submissions are locked pending a separate admin review. Published title, description and price can be updated by the owner, but lesson content and quiz keys stay fixed. Pending payment requests retain their original amount snapshot.
- Public catalogue/detail responses contain only metadata and lesson titles. Private text, S3 object keys and signed media URLs are not in those public responses.
- A free course can create an enrollment directly. A paid course cannot use that route.
- Payment amount and student identity are taken from the server, not caller-supplied price/owner fields. Manual transfer review is a human process, not provider confirmation.
- Modes are explicit: `disabled`, `test`, `manual`. Test requests remain labeled TEST ONLY and use simulated verification, never actual transfer verification.
- Receipts are uploaded using a two-minute signed POST restricted to the generated key, JPG/PNG content type, and a 5 MB maximum. The server verifies object metadata after upload. The receipt's S3 VersionId is frozen on submission, so reusing the upload URL cannot silently replace the exact version reviewed.
- The private bucket has public access blocked, encryption and versioning. Versioning is required for the receipt/video snapshot guarantees.
- Receipt retrieval is admin-only. Review rejects the student's own request even if that student is also an admin. A note is required. An approval requires an explicit manual-verification flag, or a simulated-verification flag for test requests.
- Review status update and enrollment creation use one conditional DynamoDB transaction. Replays, duplicate grants and conflicting approvals fail rather than silently overwriting data.
- Rejected or pending requests do not grant paid media access. Lesson access checks the enrollment on every request.
- Published videos pin an S3 version and use two-minute signed read URLs after the enrollment check. Instructor video uploads are restricted to the instructor/course key prefix, MP4/WebM and 100 MB. A missing upload blocks publication.
- Progress can reference only lessons in the course and only the caller's enrollment. Repeating a completion does not count the lesson twice.
- User-authored text is rendered as text or escaped HTML. SVG/HTML receipts are not accepted. The hosted frontend includes a CloudFront security-headers policy and self-hosted fonts.
- The template has no Function URL, no browser AWS credentials, no public files bucket, no Cognito Admin policy on the function, and no reused project IDs.

These are properties of the source and local tests. Live AWS deployment, JWT integration, storage permissions and browser CORS must still pass the acceptance checklist.

## What this does not protect against

- A signed URL is a bearer link. Someone with it can use it until expiry, and can retain a file they already downloaded. This is access control, not DRM or screen-recording prevention.
- Signing out clears the app session and Cognito hosted-login cookie. It does not instantly invalidate every already-issued access token or signed URL. The template uses 15-minute access tokens; immediate account suspension needs a server-side denylist or another revocation design.
- The frontend does not silently renew sessions. When a token expires, sign in again. This is a deliberate first-version limit, not persistent-login support.
- Group changes can remain in already-issued tokens until those tokens expire. Sign in again after role administration. Admin MFA must be configured and tested before real operations.
- Content-Type and upload size checks are not malware scanning, image re-encoding, video transcoding or file-signature verification. Add a quarantine/scanning workflow before allowing untrusted uploads in production. Never approve financial evidence based only on a screenshot.
- There is no connection to Vodafone Cash or any other wallet provider. No transfer initiation, automated settlement verification, refunds or payouts are implemented. `manual` only records a human owner's decision. Test mode uses synthetic evidence and no money.
- No account-level rate limiter, per-user upload quota, fraud detection, abuse queue, WAF or payment-request retention workflow is implemented. API throttles alone do not replace those controls or a budget.
- The data model uses bounded full partition queries for this teaching starter. A 2,000-record guard returns an explicit error. Before scale, add cursor pagination, payment owner/status indexes, efficient catalogue search and archive policies. DynamoDB scans are not used, but querying a large partition still costs reads.
- No unpublish/revoke/refund flow, lesson deletion or published curriculum editing is implemented. Published metadata editing is limited to title, description and price. Admin rejection is not refund processing. Add explicit entitlement revocation and audits before paid operations.
- Draft text is limited to 250 KB per course, 50 lessons, and 12,000 characters per language per text lesson. This is not a long-form LMS content store.
- Infrastructure retains data by default. Bucket versions, PITR and retained tables still incur costs until deliberately cleaned up.

## Demo is not a security boundary

The demo bundles sample lessons and stores courses, roles, receipts and progress in localStorage. Every local test view shares one browser's data. It is intentionally editable and offline. Never replace sample data with private real courses, real receipts, passwords, wallet details or student information. The test-role switch is excluded from AWS mode and never grants real admin privileges.

## V2 learning features

- AWS quiz responses omit correct-answer indices. Scoring, pass criteria and best-score persistence happen on the backend; caller score/pass flags are ignored. All lessons must be marked complete before submitting a quiz. Attempts are unlimited; this is a learning check, not a proctored exam or anti-cheating system.
- Completion records require an enrollment, all lesson completion marks, and a quiz pass when configured. The first issued learner name, title snapshot, date and result are retained. Names are self-reported, not identity-verified. No accreditation, watch-time verification, public verification endpoint, signature or tamper-proof PDF is supplied. A downloaded HTML file can be edited; it is not independent proof.
- Saved-course entries are keyed to the verified user and do not grant enrollment. Removing a saved course changes its saved flag; it does not revoke paid access.
- Review writes require enrollment and at least one completed lesson. A course owner cannot review their own course. One record per course/student prevents simple duplicate ratings from that account; this does not prevent multi-account abuse. New reviews and edits are pending until owner moderation. Only approved display names, text, rating and timestamp are returned to signed-in learners; reviewer identity keys are not exposed there.
- Review text, quiz text, learner names and course metadata are escaped before display and printable-record creation. Client rendering is still not a substitute for backend checks.
- New per-user records use the same existing table/IAM scope. No new service permission or cloud resource is needed solely for the v2 feature source. This is a source compatibility statement, not proof that a deployment update succeeds.

## V3 community features

- Lesson notes require enrollment and a real course lesson ID. The record key uses the verified user sub; callers cannot select another user. Notes are limited to 8000 characters. Only the author has an app route to read them. This is app-level isolation, not end-to-end encryption or protection against the account operator. Empty text clears contents; backup/retention/account erasure is a separate operational requirement.
- Course Q&A reads require enrollment, course ownership or verified admin authority. Questions require enrollment and an explicit public display name. Learner responses omit private user IDs. Visible posts are available to enrolled learners immediately; this is post-moderation, not pre-approval.
- Only the same course owner can create or update the single instructor reply. Foreign-course question IDs are rejected. Hidden threads cannot receive new replies. Conditional record writes prevent silent overwrite when reply/moderation races.
- Only verified admins can hide/restore threads. Hidden content remains visible to the author, course instructor and admin; hiding is not deletion. Reports are now available in v4; appeals, notifications, rate-limiting and irreversible deletion UI remain absent.
- Instructor insights filter to courses owned by the verified caller. They return aggregates only, not student identities or receipts. Test and manual approved request amount snapshots are separate. These are not verified revenue, earnings, settlement, refunds accounting or payouts. Free enrollment counts are deliberately not invented.
- Questions, notes and instructor replies are escaped before rendering, with auto text direction for mixed-language content. These controls do not replace upload scanning, abuse controls or production review.

## V4 publication and reports

- New course publication requires a separate verified admin account. An instructor's publish request validates/pins media and creates a locked pending-review snapshot. It does not expose private content to the public catalogue or grant enrollment. Already-published records are not automatically unpublished.
- Instructor editing, media-upload creation and metadata editing are blocked while pending. Rejection or owner withdrawal returns the course to draft. Every resubmission receives a new submission ID. Admin decisions must name the current ID; stale review screens cannot approve a withdrawn/replaced submission. Conditional writes also guard concurrent decisions.
- Owner review can read both content languages, quiz answer keys and a temporary URL for the submitted video version. Approval records the owner's explicit check. It is not malware scanning, copyright clearance, video-transcoding validation or a guarantee that the reviewer actually watched everything.
- Published title/description/price edits retain the earlier direct owner-only workflow. They are not re-reviewed. Published lesson content and answer keys remain immutable. A full published curriculum/entitlement migration design is still absent.
- Reports require enrollment, validated reason/details and server-derived reporter identity. Optional discussion references must belong to the same course and be visible to that reporter. Discussion snapshots come from the server, not caller-supplied evidence. A later instructor reply does not rewrite the saved snapshot.
- Only reporter and admin app routes expose reports. The instructor receives no report list and peers cannot read another user's reports. Operator/database access and the shared-browser local demo are not excluded by this app-level statement. Reports are not end-to-end encrypted.
- Report resolution is admin-only, version-conditional and requires a note visible to the reporter. It does not silently hide content, revoke access or refund payments. Reports currently allow repeated submissions; add rate limits, duplicate controls, abuse escalation, retention and an appeal process before real operations.
- Latest course review fields and resolved report records are not a full append-only moderation audit system. There is no general course unpublish/suspension UI. Human review and report recording are useful source workflows, not production safety certification.

## V5 Bedrock

Disabled by default with empty model/region and conditional exact foundation-model IAM permission. No browser credentials, model keys, tool-use functions, external retrieval, arbitrary user prompt or automatic retry. Own-course editable drafts only; saved text source bounded before invocation. Atomic instructor/platform daily attempt caps are not a financial budget. Malformed/incomplete output is not adopted. Pending/failed attempts are not replayed automatically. Explicit reviewed adoption checks source hash and course version and never publishes. Prompt framing/schema validation do not prove factual accuracy or complete injection resistance. The instructor must verify questions and answer keys. See BEDROCK.md for privacy/logging/retention and live-activation prerequisites.
