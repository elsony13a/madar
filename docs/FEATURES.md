# Feature map | خريطة نسخة v5

هذه النسخة الخامسة من منصة تعليمية متماسكة، وليست كل خصائص Udemy. لا يوجد وعد بالتكافؤ معه أو الجاهزية التجارية.

| Feature                                                       | Local demo                                     | AWS source                                                                                    | Live AWS verified |
| ------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------- |
| Original responsive identity, Arabic/English and RTL/LTR      | Works                                          | Same frontend                                                                                 | No                |
| Catalogue search, topic filter, teaching-language filter      | Sample/local courses                           | Published API catalogue                                                                       | No                |
| Course details and curriculum                                 | Works                                          | Public metadata only                                                                          | No                |
| Student/instructor account choice                             | Simulated session                              | Cognito + backend profile                                                                     | No                |
| Owner/admin                                                   | Explicit test-view switch                      | Cognito admin group only                                                                      | No                |
| Free enrollment and lesson progress                           | Browser storage                                | Enrollment-gated API + DynamoDB                                                               | No                |
| Manual paid-course receipt and owner review                   | Synthetic evidence only                        | Private S3 + conditional entitlement transaction                                              | No                |
| Instructor draft creation, edit, owner review and publication | Text courses                                   | Ownership-enforced submission/owner approval                                                  | No                |
| Private MP4/WebM lessons                                      | No fake successful video upload                | Signed upload, version pinning, signed playback                                               | No                |
| Instructor-authored quizzes                                   | Bilingual authoring and local scoring          | Server-side validation/scoring, no learner answer key                                         | No                |
| Completion record / certificate                               | Downloadable printable HTML, LOCAL DEMO        | Eligibility checked, fixed issued record                                                      | No                |
| Enrolled-student reviews and ratings                          | Local submission and owner moderation          | One record per eligible learner, moderated edits                                              | No                |
| Saved courses                                                 | Browser list                                   | Per-user saved list, no enrollment grant                                                      | No                |
| Published title/description/price editing                     | Works                                          | Owner-only, preserves lesson/quiz content and pending quotes                                  | No                |
| Private lesson notes                                          | Local save/reopen/clear, shared browser caveat | Enrollment-gated, verified-user isolated, 8000 chars                                          | No                |
| Course questions and instructor replies                       | Post/reply, owner hide/restore                 | Enrolled learners, course-owner replies, conditional updates                                  | No                |
| Instructor insights                                           | Stored local record counts                     | Own-course request/review/question aggregates only                                            | No                |
| New course publication review                                 | Submit/withdraw, owner return/approve          | Separate admin, locked submission ID, pinned video version                                    | No                |
| Learner content/discussion reports                            | Submit, status and resolution note             | Verified reporter, enrolled only, admin resolution, discussion snapshot                       | No                |
| Bedrock instructor quiz drafts                                | Fixed hand-written simulation, no inference    | Optional disabled Converse adapter, own text source, validated proposal and explicit adoption | No                |
| Frontend hosting                                              | Open standalone HTML                           | Private S3 + CloudFront OAC template                                                          | No                |
| Real wallet settlement, gateway, refund or payout             | Not present                                    | Not present                                                                                   | No                |

## Deliberate boundaries

- Q&A posts appear immediately to enrolled learners. Owner moderation hides/restores whole threads; no deletion, email alerts or promised response time. Enrolled learners can report concerns. Hidden posts remain visible to their author, course instructor and admin.
- Notes are per account in AWS source, not end-to-end encrypted. Saving blank text clears contents, not a full retention/deletion workflow. Local demo roles share storage.
- Instructor insights count stored records. Approved request amounts are not verified revenue, refunds-adjusted earnings, settlement or payouts. Free enrollments are not counted.

- Published lesson content and quiz answer keys remain immutable. Metadata editing is implemented; full curriculum revision/version migration is not.
- Completion criteria are all lesson completion marks and, when configured, a quiz pass. These are self-paced records, not verified watch time, accredited qualifications or proctored exams. Learner names are self-reported. No public certificate verification or digital signature is supplied.
- Quiz attempts are unlimited. Correct answers stay on the backend in AWS mode, but local demo sample answers are in the browser. This is not an anti-cheating system.
- Reviews require enrollment and at least one completed lesson. Owner approval controls display. There are no fabricated starter reviews, ratings or learner counts. Review-specific reporting, independent moderation and approved-review removal UI are not implemented; general course/discussion reports are available.
- Reviews are visible to signed-in users only after moderation. Their public display name and text are explicitly disclosed to the submitting learner.
- New course publication requires a separate admin review. Pending content is locked; withdrawal/rejection returns it to draft. Already-published courses remain published, and published metadata edits are not re-reviewed. Human review is not malware scanning, legal clearance or a safety guarantee.
- No automatic translation. Metadata/quiz authoring uses both languages; teaching language is separate.
- Original sample course hours are illustrative catalogue data, not supplied hours of video.
- Reports are visible only to their reporter and verified admin routes in AWS source, not the instructor or peers. The demo shares browser storage. Reports capture a discussion snapshot. Resolving one only records a note; it does not remove content or trigger refunds/access changes. There is no response-time guarantee, rate limiter, appeal or emergency support.
- Shopping carts, coupons, instructor earnings/payouts, real transfers, refunds, email notifications and general admin user management are still not implemented.
- No real wallet instructions, private AWS identifiers or credentials are shipped. Payment mode defaults to disabled in the template.

## Next learning increments

1. Complete real AWS acceptance for the current journeys, with adversarial direct API checks. Do this before adding more cloud services.
2. Extend the implemented human content-review queue with upload quotas and quarantine/scanning/transcoding. Keep existing learner content snapshots safe.
3. Add curriculum revisions with explicit entitlement migration rules. Do not reset learning or change certificates silently.
4. Add cursor pagination and status/owner indexes, then search at scale and read-cost checks.
5. Extend implemented reports with abuse rate limits, moderation appeals, escalation policies and approved-review removal controls.
6. Add certificate verification only with a deliberate privacy design and tamper-resistant verification. Do not present a printable local file as independently verified.
7. Add a real payment provider only after provider/account/fees decisions, signed webhook verification, ledger/audit events, refunds, access revocation and payout controls.
8. Add admin MFA, operational alerts, restore tests, retention/account deletion, accessibility checks with users and incident procedures.

## Local verification

The final `verification.txt` records test totals. Browser scenarios cover every first-version journey plus saved courses, instructor quiz authoring, quiz failure/retry/pass, certificate eligibility and downloaded HTML, review moderation, published metadata editing, private notes, questions/replies, discussion moderation, instructor insights, publication review/return/approval/withdrawal and learner reports. Layout checks use 320, 390 and 1280 px viewports with screenshots. Frontend/backend builds and local SAM lint are checks of the source, not of deployment. Dependency audits are point-in-time known-advisory checks, not a security certification.

## Bedrock boundary

See BEDROCK.md. No model or region was selected, no inference occurred, and no model quality/cost claim is made. Model/API/region support, access prerequisites, data handling and financial activation decisions remain open. Text-only saved drafts, 1-3 questions, explicit review before adoption. Deterministic learner scoring is unchanged. Local simulation is not generated from lessons.
