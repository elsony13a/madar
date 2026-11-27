# Amazon Bedrock quiz drafts, v5

Prepared 20 November 2026. This is source integration and a local demonstration, not a live activation or an actual model response.

## Implemented flow

An instructor saves an editable course draft and chooses **Bedrock quiz draft** on its card. In AWS mode, the app first reads the server's activation status and configured model/region. If disabled, generation is unavailable. If enabled, the instructor confirms permission to send the saved lesson content and understands that a request may incur charges. The server reads only that instructor's own saved text-course source. Client model IDs, prompts and student data are not accepted as generation inputs.

The backend sends one Converse request through `@aws-sdk/client-bedrock-runtime`. It asks for 1-3 bilingual multiple-choice questions, exactly three options each and a correct-answer index. The response must be complete JSON and pass the same bounded quiz validator as manual authoring. Invalid, blocked or incomplete responses are not adopted. A schema-valid answer can still be wrong, misleading or poorly translated.

A successful response is stored as a separate private proposal. It does not change the quiz, score students, publish the course or grant enrollment. The instructor reads both languages and every correct answer, then explicitly adopts it. Adoption replaces the quiz in the editable draft only, uses a conditional transaction, and fails if the course/lessons changed since generation. Manual quiz editing still works afterward. Course publication still requires the separate owner's review. Student scoring remains deterministic backend logic, with no Bedrock request during learning, marking or certificate issuance.

## Local preview is not AI

The standalone HTML works offline. Its instructor button shows a fixed, hand-written example about access controls and completion records. It is **not generated from the instructor's lessons**, not a model response and not evidence that Bedrock works on any AWS account. It exists to demonstrate review, discard and adoption. It sends no request and requires no AWS credential. All local roles share editable browser storage, so it is not private between people using that browser.

## Configuration shipped safely disabled

The optional SAM template adds these parameters:

| Parameter        | Shipped value | Meaning                                                                       |
| ---------------- | ------------- | ----------------------------------------------------------------------------- |
| `BedrockEnabled` | `false`       | No model invocation path enabled by default                                   |
| `BedrockRegion`  | empty         | Must be deliberately selected before activation                               |
| `BedrockModelId` | empty         | Must be a compatible base foundation-model ID, not a guessed model or profile |

The Lambda receives corresponding `BEDROCK_ENABLED`, `BEDROCK_REGION` and `BEDROCK_MODEL_ID` variables. The runtime validates configuration when enabled. The template grants `bedrock:InvokeModel` only when enabled and only for the configured region/model foundation-model ARN. It does not grant Marketplace subscription, streaming invocation or wildcard model access. The browser never receives AWS credentials or directly invokes Bedrock.

This version deliberately supports an **in-region base foundation model** using Converse with system messages and a 2048-token output limit. It does not configure cross-region inference profiles, provisioned capacity, Marketplace endpoints, custom/imported models, Agents, Knowledge Bases, Guardrails or video transcription. Not every model supports this request shape or in-region on-demand invocation. Do not turn the feature on with an arbitrary ID. Selecting a compatible model/region and proving the live behavior remain pending.

## Limits and failure behavior

- Text-only saved courses. A course containing a video lesson is refused rather than pretending to read video. No transcription service is configured.
- Maximum 12,000 characters for the serialized course title and lesson source. Oversized content is rejected without silent truncation. This is a character bound, not a precise token count.
- 1-3 questions, 3 options, bilingual fields up to 500 characters. Output JSON maximum 32 KB; Converse output maximum 2048 tokens. A long bilingual response can hit the token cap and be rejected, while the attempted request may still cost money.
- Atomic caps: 3 attempts per instructor and 20 platform-wide per UTC day. The reservation is stored before invocation. Failures, malformed responses and timeouts consume attempts. Caps apply through this application path only, not other AWS principals or tools.
- A request ID is reserved once. Repeating a completed ready request with the same course/source/count returns its stored proposal without a second model call. Reusing an ID with other input is rejected. Pending/failed/adopted requests are not automatically invoked again.
- SDK `maxAttempts` is 1; an explicit 20-second abort limit bounds how long the app waits. An abort or lost response does not prove the provider stopped or that nothing was charged. A new manual attempt can cost again. A process interruption can leave a pending record requiring operator inspection.
- Conditional quota transactions can return a conflict during concurrent requests, before a model call. This is intentional rather than silently exceeding the cap.
- **These request/token bounds are not a money budget or a guarantee of maximum account spend.** Pricing, input tokenization, model prerequisites and other AWS usage still matter.

## Data and output safety

Only the saved draft's title and text lessons are sent, after the instructor's confirmation. Receipts, student notes, reports, enrollments, quiz-attempt history, authentication tokens and secret configuration are not included. The app does not log prompts or raw responses. It retains successful proposals, token-usage metadata, source hashes and request/quota state in its own DynamoDB table. No automated deletion/TTL or complete AI audit-retention policy is implemented.

Lesson content is labeled untrusted source material. The model receives no tools, browsing, retrieval or side-effect functions. Its output is parsed, validated and escaped rather than executed. These measures limit what an injected lesson or bad response can do, but do not guarantee resistance to prompt injection or factual correctness. Human review remains required. No claim of a configured Bedrock Guardrail is made.

Account-level model-invocation logging, retention settings, model terms and operator access must be reviewed separately. Do not promise that content is never retained merely because the app does not log it. AWS documentation describes Converse content behavior, separately configurable invocation logging, and model/account retention choices. The current account settings and chosen model are not known here.

## Activation decisions still needed, not authorized by this source package

1. Select a model and region using the current AWS compatibility and regional-availability tables. Verify Converse, system-message support, in-region on-demand invocation, output budget and Arabic quality.
2. Inspect model access and provider/account prerequisites. Some models involve Marketplace subscription or provider requirements. An initial invocation can have subscription implications. Do not accept terms, subscribe, invoke or broaden IAM on the user's behalf without authority.
3. Check current pricing for that exact model/region and approve an intended budget and operating plan. Add account budget alerts and suitable application/user controls. No numeric price estimate is invented before the model is chosen.
4. Review the rights to send course content, data residency, model terms, account logging and retention. Configure the approved policy deliberately.
5. Only after authorized deployment/configuration, test with non-sensitive owned text: disabled path, wrong roles, positive generation, invalid output, quotas, duplicate ID, stale adoption, manual edit, owner review, enrolled student quiz and absence of answer keys. Check logs and actual billed usage. All live items are currently unrun.

## Current AWS sources

Official references fetched on 20 November 2026, not a statement of the user's account state:

- Converse request/response, IAM action and system/inference fields: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
- Model access and possible account/provider/Marketplace prerequisites: https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html
- Current API compatibility: https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html
- Current region and routing availability: https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html
- Exact pricing must follow the selected model and configuration: https://aws.amazon.com/bedrock/pricing/
- Configurable invocation logging, including prompts/responses: https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html
- Shared responsibility and data protection: https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html
- Model/account/project retention distinctions: https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html

No model, account, region price, subscription, logging configuration or retention choice was verified on a live account. No model inference, cloud mutation, new account or spending occurred during this implementation.
