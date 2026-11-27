# API and data contract

All paths are relative to `ApiBaseUrl`. JSON responses. Send Cognito **access token** as `Authorization: Bearer ...` on protected routes. HTTP API payload version is 2.0. CORS allows only the configured frontend origin(s). There is no Function URL.

## Catalogue, account and learning

| Method | Path                                           | Required authority | Behavior                                              |
| ------ | ---------------------------------------------- | ------------------ | ----------------------------------------------------- |
| GET    | `/courses`                                     | Public             | Published metadata only                               |
| GET    | `/courses/{courseId}`                          | Public             | Metadata and lesson titles, never private bodies/keys |
| GET    | `/me`                                          | Signed in          | Current verified sub and effective role               |
| POST   | `/me/role`                                     | Signed in          | `{role: student or instructor}`; admin is rejected    |
| GET    | `/me/enrollments`                              | Signed in          | Only the caller's courses/progress                    |
| POST   | `/courses/{courseId}/enroll`                   | Signed in          | Free courses only; paid returns 402                   |
| PUT    | `/courses/{courseId}/progress`                 | Enrolled           | `{lessonId}`; validates course membership             |
| GET    | `/courses/{courseId}/lessons/{lessonId}/media` | Enrolled           | Private text body or short-lived signed video URL     |

## Instructor

| Method | Path                                    | Behavior                                                                    |
| ------ | --------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/instructor/courses`                   | Only the caller's draft/pending/published records                           |
| POST   | `/instructor/courses`                   | Validated bilingual draft, server-owned ID and ownerSub                     |
| PUT    | `/instructor/courses/{id}`              | Owner may update own draft only                                             |
| POST   | `/instructor/courses/{id}/media-upload` | Owner-only, `{contentType}`, returns signed POST fields                     |
| POST   | `/instructor/courses/{id}/publish`      | Validates/pins videos, locks content as pending-review until admin approval |

Course draft shape: `title:{en,ar}`, `subtitle:{en,ar}`, `author`, `category` from Cloud/Design/Development/Data/Business, `language` ar/en, `level` Beginner/Intermediate, integer `priceCents` in **EGP minor units**, and `lessons[]`. Lesson: bilingual `title`, `minutes`, `type:text` with bilingual `body`, or `type:video` with an uploaded `mediaKey`. Missing video is permitted in draft but blocks publication. IDs are generated in lesson order by the backend. Currency is EGP in this version, not a configurable multi-currency checkout.

## Manual payment review

| Method | Path                           | Required authority                 | Behavior                                                                           |
| ------ | ------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------- |
| GET    | `/payment-method`              | Signed in                          | Server mode and configured instructions                                            |
| POST   | `/courses/{id}/payments`       | Signed in                          | `{contentType}`; snapshot price/sub from server; creates upload target, not access |
| POST   | `/payments/{id}/submit`        | Request owner                      | Checks uploaded receipt and freezes S3 version; pending only                       |
| GET    | `/me/payments`                 | Signed in                          | Only the caller's requests, not file keys                                          |
| GET    | `/admin/payments`              | `MadarAdmins`                      | Owner review list                                                                  |
| GET    | `/admin/payments/{id}/receipt` | `MadarAdmins`                      | Signed read for the frozen receipt version                                         |
| POST   | `/admin/payments/{id}/review`  | `MadarAdmins`, not request student | Conditional decision and entitlement transaction                                   |

Review body: `decision:approved|rejected`, a 3-1000 character `note`; approval also requires `verifiedTransfer:true` for manual mode or `verifiedTest:true` for test mode. These booleans record the owner's declared review. They do not verify a wallet or bank transfer automatically.

State machine:

```text
paid request -> awaiting-upload -> pending -> approved + enrollment
                                      \-> rejected, no enrollment
```

Receipt upload failure leaves `awaiting-upload` and no access. Old incomplete requests are not automatically deleted in this starter. A repeated or concurrent decision returns conflict instead of resetting progress or granting twice.

## DynamoDB single-table model

Table keys are `PK` and `SK`, both Strings. There is no dependency on a table from another project.

| PK                    | SK                   | Record                                                                          |
| --------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `USER#<verified-sub>` | `PROFILE`            | student/instructor role                                                         |
| `USER#<verified-sub>` | `ENROLL#<courseId>`  | approved/free access and completed lesson IDs                                   |
| `COURSE`              | generated course ID  | owned draft or published snapshot                                               |
| `PAYMENT`             | generated request ID | price snapshot, student, status, frozen receipt version and review audit fields |

Each mutable record has a version for conditional writes. Query partitions are intentionally simple for learning, with a 2,000-record guard. Add proper indexes and cursor pagination before real scale; do not remove the guard to hide a scaling issue.

## S3

- `receipts/<verified-sub>/<request-id>`: private, versioned evidence. No SVG/HTML upload.
- `courses/<verified-sub>/<course-id>/<generated-id>`: private lesson media. Published courses pin exact versions.
- Website assets are in a **different bucket** from receipts and lessons. Only website assets are exposed through CloudFront.

The browser never chooses an arbitrary bucket, owner prefix or receipt object version. Signed URLs expire after 120 seconds. Never put signed URLs into public catalogues or logs.

## V2 additions

All endpoints below require a verified Cognito access token. The existing protected proxy route covers them; no new Function URL or cloud service is added.

| Method | Path                               | Authority and behavior                                                                                         |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/me/saved`                        | Caller's saved course IDs only                                                                                 |
| POST   | `/me/saved`                        | `{courseId,saved:true/false}`; no enrollment effect                                                            |
| GET    | `/courses/{id}/quiz`               | Enrolled only; questions/options, never answer key                                                             |
| POST   | `/courses/{id}/quiz`               | All lessons complete; `{answers:[zeroBasedIndex,...]}`; server score, best result retained                     |
| GET    | `/courses/{id}/certificate`        | Caller's already-issued record, enrollment required                                                            |
| POST   | `/courses/{id}/certificate`        | All lesson marks and required quiz pass; `{learnerName}`; fixed first-issued record                            |
| GET    | `/courses/{id}/reviews`            | Signed-in users; approved display fields only                                                                  |
| PUT    | `/courses/{id}/reviews`            | Enrolled and one lesson complete, not instructor's own course; `{rating,displayName,text}`; pending moderation |
| GET    | `/admin/reviews`                   | MadarAdmins only, pending moderation queue                                                                     |
| POST   | `/admin/reviews/{encodedReviewId}` | MadarAdmins only; `{decision:approved/rejected}`                                                               |
| PUT    | `/instructor/courses/{id}/details` | Owner only; bilingual title/subtitle and integer priceCents; lessons/quiz ignored and preserved                |

Draft input optionally includes `quiz:{passPercent,questions:[{prompt:{en,ar},options:[{en,ar},...],correctIndex}]}`. Pass percentage is integer 50-100; backend accepts 1-20 questions with 2-4 options, frontend authoring currently uses three options. Lesson IDs and question IDs are server-generated. Public course metadata adds `hasQuiz` and `quizPassPercent`, never the answer key. Existing courses without a quiz remain valid.

Enrollment response adds optional `quizScore`, `quizPassed`, `quizAttempts`. These fields are server-generated. Completion-record ID is not a public verification token, and no public lookup is implemented.

Additional table records: `USER#sub / SAVED#courseId`, `USER#sub / CERT#courseId`, and `REVIEW / courseId#sub`. Review records are versioned and have pending/approved/rejected state; edits return to pending. The authenticated moderation ID must be URL-encoded because it contains `#`. No unbounded table scan is introduced; the starter's 2,000-record partition guard still applies.

## V3 community and instructor insights

All endpoints require a verified access token. The existing protected proxy route covers them. IDs containing `#` must be URL-encoded. No new cloud resource is introduced by this source increment.

| Method | Path                                        | Authority and behavior                                                                         |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/courses/{id}/notes/{lessonId}`            | Enrolled; caller's note only, empty text if not saved                                          |
| PUT    | `/courses/{id}/notes/{lessonId}`            | Enrolled; `{text}` up to 8000 chars, blank clears contents                                     |
| GET    | `/courses/{id}/questions`                   | Enrolled/course owner/admin; visible threads, plus own hidden threads; owner/admin may see all |
| POST   | `/courses/{id}/questions`                   | Enrolled; `{title,text,displayName}`, visible immediately                                      |
| POST   | `/courses/{id}/questions/{encodedId}/reply` | This course owner only; `{text}`, creates/updates single reply, hidden thread rejected         |
| GET    | `/admin/questions`                          | MadarAdmins; all stored threads with moderation data                                           |
| POST   | `/admin/questions/{encodedId}`              | MadarAdmins; `{status:visible/hidden}`, conditional write                                      |
| GET    | `/instructor/insights`                      | Instructor; own-course counts and approved request snapshot sums, no student-level records     |

Question title: 5-180 characters. Question text: 10-4000. Public display name: 2-60. Reply: 5-4000. Server trims validated question/reply fields. Notes preserve entered whitespace. All notes validate the lesson belongs to the published course.

Additional table records: `USER#sub / NOTE#courseId#lessonId` and `QUESTION / courseId#generatedId`. Question records have visible/hidden status, versioned updates, public display name, author sub and optional single reply with timestamp. Learner GET responses omit author sub and moderation identity; owner/admin moderation route remains privileged. Insights expose `courseCount`, `published`, `drafts`, `awaitingReview`, `approvedRequests`, `testApprovedAmountCents`, `manualApprovedAmountCents`, `approvedReviewCount`, `averageRating` (null without ratings), `unansweredQuestions`, `currency` and an explanatory `notice`. Existing bounded partition guards still apply.

## V4 publication approval and learner reports

`POST /instructor/courses/{id}/publish` is retained as a compatibility path name but now **submits for review**, not direct publication. Its response status is `pending-review`. New video submissions require immutable S3 versions. Existing published records stay published; no automatic migration or unpublishing occurs. Pending content and price/metadata are locked. Published metadata edits remain owner-only without another review, while published curriculum stays fixed.

| Method | Path                                           | Authority and behavior                                                                                                                                                                              |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/instructor/courses/{id}/withdraw`            | Course owner with instructor role; pending-review to draft, invalidates old submission approval                                                                                                     |
| GET    | `/admin/courses`                               | MadarAdmins; pending submissions, including bilingual private content and quiz key for review                                                                                                       |
| GET    | `/admin/courses/{id}/lessons/{lessonId}/media` | MadarAdmins; pending submitted video only, two-minute URL for pinned version                                                                                                                        |
| POST   | `/admin/courses/{id}/review`                   | MadarAdmins, not course owner; `{decision:approved/rejected,note,submissionId,contentChecked:true}`. Check required for approval only. Approved becomes published; rejected returns draft with note |
| POST   | `/courses/{id}/reports`                        | Enrolled; `{reason,details,questionId?}`. Server-owned reporter identity and discussion snapshot                                                                                                    |
| GET    | `/me/reports`                                  | Caller's own reports, no internal reporter/admin identity keys                                                                                                                                      |
| GET    | `/admin/reports`                               | MadarAdmins; reports and reporter account IDs                                                                                                                                                       |
| POST   | `/admin/reports/{encodedId}`                   | MadarAdmins; `{note}` resolves open report only, note visible to reporter                                                                                                                           |

Course review note and report resolution note are 3-1000 characters. Report reason is `content`, `harassment`, `copyright` or `other`; details are 10-2000 characters. Optional question ID must belong to the same course and be visible to the reporter (or be their own hidden question). A server-created snapshot preserves the title, question, instructor reply, public display name and visibility at report time. Caller-supplied snapshots and reporter IDs are ignored. Reports do not automatically hide content, revoke enrollment or refund payments. There is no guaranteed response time, emergency service, appeal or abuse rate limiter.

Course records add `submissionId`, `submittedAt`, `contentReviewStatus`, latest `reviewNote`, `reviewedAt`, `reviewedBy` and optional withdrawal time. Review approval requires the exact current submission ID and a conditional version write. This is not an append-only moderation audit ledger. Existing sample courses remain marked as published in demo mode.

New table partition: `REPORT / courseId#generatedId`. Records retain course title, verified reporter sub, optional discussion snapshot, reason/details, open/resolved status and resolution fields. Existing bounded partition limits apply; before scale, add reporter/status indexes and cursor pagination. Instructor insights now include `awaitingReview`.

## V5 optional Bedrock quiz drafts

All routes require verified instructor role, same-course ownership and editable draft state.

| Method | Path                                     | Behavior                                                                                                                                             |
| ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/instructor/courses/{id}/ai-quiz`       | Server activation/configuration status and request limits; no invocation                                                                             |
| POST   | `/instructor/courses/{id}/ai-quiz`       | `{count:1..3,consent:true,requestId}`; server reads saved text source, reserves caps, invokes at most once, validates and stores proposal separately |
| POST   | `/instructor/courses/{id}/ai-quiz/adopt` | `{requestId,reviewed:true}`; unchanged draft/hash/version only; atomically adopts stored quiz, never publishes                                       |

Request IDs are 16-64 ASCII letters/digits/hyphens. The server ignores client model, region, prompt, student data and quiz contents. Status is disabled by default. Proposals return request ID, validated quiz, model/region, source hash and optional usage. They are private instructor authoring data, never learner answer-key responses. Existing learner quiz API/scoring is unchanged. See BEDROCK.md for caps, failure/billing caveats and configuration.

New records: `USER#sub / AIQUIZ#requestId` pending/ready/failed/adopted; `USER#sub / AIQUOTA#UTC-date`; `AIQUOTA / UTC-date` global attempt count. Quota/reservation and adoption are conditional transactions. Successful proposals retain model/region, source hash, base course version, output quiz and token metadata; adoption adds private provenance to course. No retention TTL is configured.
