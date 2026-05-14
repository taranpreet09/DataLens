# Implementation Plan: Intelligence Layer

## Overview

The Intelligence Layer ships in four LLM-assisted slices on top of Obsidian Analytics:

- **5a — Natural Language Queries:** plain-English questions → `AnalysisIntent` → existing analysis handlers.
- **5b — Auto-Generated Narratives:** stats → multi-section markdown.
- **5c — Text Column NLP:** sentiment, topics, keywords via Python (NLTK + scikit-learn).
- **5d — Automated EDA Reports:** `ydata-profiling` + LLM narrative + plots.

All four share one Bedrock gateway, a redaction pipeline, a token-budget guard, and a structured logger.

This plan is grouped so partial completion still ships value: the foundation lands first (group 1), the Bedrock plumbing next (group 2), then each user-facing slice in order (5a → 5b → 5c → 5d), and finally the cross-cutting integration work. Each slice's backend lands before its frontend so progress can be smoke-tested by any HTTP client.

**Naming constraint.** No new file, route, identifier, or environment-variable subsystem label uses the tokens `phase3`, `phase4`, or `phase5`. Node routes mount at `/api/intelligence/*`; Python routes live under `/intelligence/nlp/*` and `/intelligence/eda/*`. The legacy `data_backend/routes/phase3.js` is not modified.

**Property-test convention.** Each Correctness Property (P1–P17) from `design.md` is its own optional sub-task (`*`). Property tests use `fast-check` (Node, ≥ 100 iterations) or `hypothesis` (Python). Each property test references both the property number and the requirement it validates.

## Tasks

- [x] 1. Foundation — dependencies, configuration, error envelope, logger, redactor, dataset-context builder
  - [x] 1.1 Add backend dependencies and environment scaffolding
    - Add `@aws-sdk/client-bedrock-runtime` (^3.685.0) and `zod-to-json-schema` (^3.23.5) to `data_backend/package.json` dependencies
    - Add `fast-check` (^3.x) and `aws-sdk-client-mock` to `data_backend/package.json` devDependencies
    - Append `INTELLIGENCE_LAYER_ENABLED`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_MODEL_ID`, `BEDROCK_TOKEN_BUDGET`, `BEDROCK_TIMEOUT_MS` to `data_backend/.env.example` with the documented defaults
    - Run `npm install` in `data_backend/`
    - _Requirements: 12.1_

  - [x] 1.2 Create `data_backend/config/intelligence.js`
    - Export `intelligenceConfig()` returning `{ enabled, region, modelId, tokenBudget, timeoutMs, credentialsResolved }`
    - Default `modelId` to `anthropic.claude-sonnet-4-20250514-v1:0`
    - Default `region` to `us-east-1`, `tokenBudget` to 12000, `timeoutMs` to 60000
    - `credentialsResolved` is true when `AWS_ACCESS_KEY_ID` AND `AWS_SECRET_ACCESS_KEY` are set, OR `AWS_PROFILE` is set, OR `AWS_ROLE_ARN` is set
    - `enabled` is `(process.env.INTELLIGENCE_LAYER_ENABLED ?? 'true').toLowerCase() !== 'false'`
    - _Requirements: 1.2, 1.3, 1.6, 12.1_

  - [x] 1.3 Create `data_backend/services/intelligenceLogger.js`
    - Export `logEvent(record)` that writes a single structured JSON object to `console.log` with a `ts` (ISO string) and `service: 'intelligence'` prefix
    - Export `withCode(code, message, extra = {})` that returns an `Error` with `.code`, `.retryable`, and any extra fields attached
    - Strip any field whose key is one of `prompt`, `messages`, `responseBody`, `text`, `body` from the record before emitting (defensive guard)
    - _Requirements: 1.8, 12.5_

  - [ ]* 1.4 Property test P17 — logger never includes prompt or response bodies
    - **Property 17: Logger never includes prompt or response bodies**
    - **Validates: Requirements 1.8, 12.5**
    - Generate random log records that include forbidden keys and sentinel cell values, assert the emitted log line contains neither

  - [x] 1.5 Create `data_backend/services/redactor.js`
    - Export `redact(rows, semanticTypes)` that returns a new array; replace cells with `"[REDACTED]"` when `semanticTypes[col].semanticType` is `email`, `phone`, or `creditcard`
    - Apply a column-name heuristic: any header matching `/email|phone|mobile|cell|ssn|tax|card|cvv|account/i` is redacted regardless of detector confidence
    - Export `truncateString(s, max=200)` that returns `s` unchanged when `s.length <= max`, otherwise `s.slice(0, max) + '…'`
    - Export `estimatePayloadBytes(obj)` that returns `Buffer.byteLength(JSON.stringify(obj), 'utf8')`
    - Pure module — no I/O, no mutation of inputs
    - _Requirements: 2.3, 2.4_

  - [ ]* 1.6 Property test P1 — redactor never leaks PII column values
    - **Property 1: Redactor never leaks PII column values**
    - **Validates: Requirements 2.4**
    - For arbitrary rows and any column whose semantic type is email/phone/creditcard, output contains `"[REDACTED]"` for that column on every row and contains none of the original cell values

  - [ ]* 1.7 Property test P3 — long string truncation is bounded and idempotent
    - **Property 3: Long string truncation is bounded and idempotent**
    - **Validates: Requirements 2.3**
    - For arbitrary string `s`, `truncateString(s, 200).length <= 201` and `truncateString(truncateString(s)) === truncateString(s)`

  - [x] 1.8 Create `data_backend/services/datasetContext.js`
    - Export `buildDatasetContext(dataset, { sampleRows = 5, maxSampleRows = 10 } = {})` returning the `Dataset_Context` shape from the design
    - Read up to `min(sampleRows, maxSampleRows, 10)` rows from `dataset.parsedFilePath` using a stratified sample helper (private to this module — do not import from `routes/phase3.js`)
    - Apply `redactor.redact` and per-cell `truncateString(s, 200)`
    - Trim numeric stats to top 12 columns (lowest `nullPct` first), categorical stats to top 8 (highest cardinality), correlation insights to top 8 by `|r|`
    - Hard ceiling of 10 sample rows enforced regardless of options
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 1.9 Property test P2 — sample size never exceeds 10
    - **Property 2: Sample size never exceeds 10**
    - **Validates: Requirements 2.1, 2.2**
    - For arbitrary dataset and arbitrary `sampleRows`/`maxSampleRows` options, `Dataset_Context.sampleRows.length <= 10`

  - [x] 1.10 Create `data_backend/services/llmRateLimiter.js`
    - Export `checkLlmBudget(userId)` that uses `INCR` + `EXPIRE` on key `intelligence:llm:budget:${userId}` with TTL 3600
    - First call after expiry sets TTL to 3600
    - The 31st call within the window throws `{ code: 'LLM_RATE_LIMITED', retryAfterSeconds: ttl }`
    - Fail-open with a warning log if Redis is unreachable (mirrors `services/jobQueue.js`)
    - _Requirements: 12.4_

  - [ ]* 1.11 Property test P14 — per-user LLM budget caps invocations within the window
    - **Property 14: Per-user LLM budget caps invocations within the window**
    - **Validates: Requirements 12.4**
    - For arbitrary userId, the first 30 calls succeed and the 31st throws `LLM_RATE_LIMITED` with a positive `retryAfterSeconds`

  - [x] 1.12 Extend `data_backend/models/Dataset.js` with narrative and edaReport sub-schemas
    - Add `NarrativeSchema` (`sections`, `fullMarkdown`, `tone`, `model`, `generatedAt`)
    - Add `EdaReportSchema` (`etag`, `profile`, `plots`, `narrative`, `fullMarkdown`, `samplingApplied`, `generatedAt`)
    - Attach as nullable sub-documents on `datasetSchema`
    - _Requirements: 6.7, 10.7_

  - [x] 1.13 Create error-envelope wrapper utility in `data_backend/routes/intelligence.js` skeleton
    - Create `routes/intelligence.js` exporting an Express router with the auth middleware applied
    - Add an internal `wrap(fn)` helper that catches errors and responds with `{ code, message, retryable, retryAfterSeconds? }` plus a `code → status` map covering every code listed in `design.md` § Error Envelope
    - Add an internal `lookupDataset(req)` helper that loads the dataset by `:datasetId` scoped to `req.userId` and 404s if missing
    - Mount the router in `server.js` at `/api/intelligence` behind the existing `apiLimiter`
    - Add only `GET /api/intelligence/health` for now (full endpoints land in later tasks)
    - _Requirements: 12.3, 13.1_

  - [ ]* 1.14 Property test P13 — error envelope shape is uniform
    - **Property 13: Error envelope shape is uniform**
    - **Validates: Requirements 13.1**
    - Drive `wrap(fn)` with errors of every documented `code` and assert the response body always has string `code`, string `message`, boolean `retryable`

- [x] 2. Bedrock gateway, tool registry, and prompt templates
  - [x] 2.1 Implement `data_backend/services/bedrockClient.js`
    - Export `invokeModel({ feature, messages, datasetId, userId, modelOverride })` returning `{ text, model, latencyMs, inputTokensEstimate, outputTokensEstimate }`
    - Build the Anthropic Messages body (`anthropic_version: 'bedrock-2023-05-31'`, `max_tokens: 2000`, `temperature: 0.2`)
    - Reject with `PAYLOAD_TOO_LARGE` when `JSON.stringify(body).length > 200_000`
    - Reject with `TOKEN_BUDGET_EXCEEDED` when `ceil(serialized.length / 4) > tokenBudget`
    - Throw `BEDROCK_NOT_CONFIGURED` synchronously when `intelligenceConfig().credentialsResolved === false`
    - Use `AbortController` to enforce `timeoutMs`; on abort throw `BEDROCK_TIMEOUT`
    - Retry up to 3 times with backoff `500 * 2^attempt` ms on `ThrottlingException`, `ServiceUnavailableException`, HTTP 429, or HTTP 5xx; non-retryable errors fail immediately
    - Emit one `intelligenceLogger.logEvent({ event: 'llm.invoke', ... })` per call with `outcome` ∈ `success | timeout | budget_exceeded | payload_too_large | not_configured | retryable_error | non_retryable_error`; never log prompt or response bodies
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 Property test P4 — payload size cap is enforced before Bedrock call
    - **Property 4: Payload size cap is enforced before Bedrock call**
    - **Validates: Requirements 2.5**
    - For messages whose serialized length exceeds 200_000 bytes, `invokeModel` throws `PAYLOAD_TOO_LARGE` and the mocked Bedrock client receives zero `send` calls

  - [ ]* 2.3 Property test P5 — token budget is enforced before Bedrock call
    - **Property 5: Token budget is enforced before Bedrock call**
    - **Validates: Requirements 1.7**
    - For arbitrary messages and budget, when `ceil(serialized/4) > tokenBudget` `invokeModel` throws `TOKEN_BUDGET_EXCEEDED` without contacting AWS

  - [ ]* 2.4 Unit tests for Bedrock retry, timeout, and credential gating
    - Use `aws-sdk-client-mock` to simulate 429 → 429 → 200 (succeeds on third attempt)
    - Simulate a hung response and assert the `AbortController` produces `BEDROCK_TIMEOUT`
    - Clear AWS env vars and assert `BEDROCK_NOT_CONFIGURED` is thrown without any SDK construction
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 2.5 Implement `data_backend/services/toolRegistry.js`
    - Define `TOOL_SCHEMAS` for every tool listed in `design.md` § Tool Registry: `descriptive_stats`, `correlation`, `regression`, `kmeans`, `feature_importance`, `anomaly_detection`, `forecast`, `fft`, `t_test`, `anova`, `chi_square`, `normality`, `confidence_intervals`
    - For each tool, store `{ schema, description, requiredColumns(params), invoke(datasetId, userId, params) }`
    - `invoke` adapters call into existing handlers in `services/statsEngine.js`, `services/analysisEngine.js`, and `services/statisticalTests.js` — load rows via a private `getDatasetRows()` helper copied (not imported) from `routes/phase3.js`
    - Export `dispatch(intent, dataset, userId)` that runs validation in this order: unknown tool → Zod parse → required columns subset of `dataset.headers` → invoke
    - Export `catalogue()` returning `{ tool, description, parameterSchemaJson }` using `zod-to-json-schema`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.6 Property test P6 — registry never dispatches to unknown tools
    - **Property 6: Tool registry never dispatches to unknown tools**
    - **Validates: Requirements 3.3**
    - For arbitrary `intent.tool` not in `TOOL_SCHEMAS`, `dispatch` returns `UNKNOWN_TOOL` and no handler spy is called

  - [ ]* 2.7 Property test P7 — registry never dispatches with invalid parameters
    - **Property 7: Tool registry never dispatches with invalid parameters**
    - **Validates: Requirements 3.4**
    - For arbitrary registered tool with parameters that fail Zod validation, `dispatch` returns `INVALID_PARAMETERS` with a non-empty `issues` array and no handler is invoked

  - [ ]* 2.8 Property test P8 — registry rejects references to columns not present
    - **Property 8: Tool registry rejects references to columns not present**
    - **Validates: Requirements 3.5**
    - For arbitrary parameters referencing a column missing from `dataset.headers`, `dispatch` returns `UNKNOWN_COLUMN` and no handler is invoked

  - [x] 2.9 Implement `data_backend/services/promptTemplates.js`
    - Pure functions — no side effects
    - `nlQueryMessages(context, question, catalogue)` returns a role-tagged Anthropic messages array instructing the model to return `AnalysisIntent | null`
    - `nlQueryNarrative(intent, resultSummary)` returns messages for the 1–3 sentence summary
    - `narrativeMessages(context, sections, tone)` returns messages instructing the model to return `{ sections: { [name]: markdown } }`
    - `edaNarrativeMessages(profileSummary, sections)` returns messages for the EDA narrative (4–8 markdown sections)
    - _Requirements: 4.3, 6.4, 10.6_

- [x] 3. Checkpoint — foundation and gateway
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 5a Natural Language Query — backend
  - [x] 4.1 Implement `data_backend/services/nlQueryService.js`
    - Export `handleNlQuery({ dataset, userId, question })`
    - Validate `3 <= question.length <= 500` else throw `INVALID_QUESTION_LENGTH`
    - Call `checkLlmBudget(userId)` before any Bedrock call
    - Build `Dataset_Context` via `datasetContext.buildDatasetContext`
    - Invoke Bedrock with `feature: 'nl_query'` using `promptTemplates.nlQueryMessages(...)`
    - Parse the response as JSON (strip ``` fences if present); on parse failure throw `INTENT_PARSE_ERROR`
    - If `intent === null`, return `{ intent: null, suggestion, supportedTools }` from the registry catalogue
    - Otherwise call `toolRegistry.dispatch(intent, dataset, userId)`; bubble registry errors with the documented codes
    - Build a result summary and call Bedrock again with `feature: 'nl_query_narrative'`; concatenate to a 1–3 sentence string
    - Return `{ intent, result, narrative, executionTimeMs }`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9_

  - [x] 4.2 Wire `POST /api/intelligence/:datasetId/nl-query` in `routes/intelligence.js`
    - Apply `authMiddleware`
    - Call `lookupDataset` then `nlQueryService.handleNlQuery`
    - Return 200 for both successful intents and the `intent: null` refusal path
    - Map registry validation errors to HTTP 422
    - _Requirements: 4.1, 4.7_

  - [ ]* 4.3 Property test P9 — question length validation is total and exact
    - **Property 9: Question length validation is total and exact**
    - **Validates: Requirements 4.9**
    - For arbitrary string `question`, `handleNlQuery` succeeds iff `3 <= length <= 500`; outside that range it returns `INVALID_QUESTION_LENGTH` and no Bedrock call is made

  - [ ]* 4.4 Unit tests for NL query happy/refusal paths
    - Mock Bedrock to return a valid `AnalysisIntent`, mock the registry handler, assert the response shape
    - Mock Bedrock to return `null`, assert refusal path returns `intent: null` plus suggestions and HTTP 200
    - Mock Bedrock to return malformed JSON, assert `INTENT_PARSE_ERROR`
    - _Requirements: 4.4, 4.7_

- [x] 5. 5a Natural Language Query — frontend
  - [x] 5.1 Add `intelligenceApi` namespace to `data_frontend/src/lib/api.js`
    - Export `intelligenceApi` with `health`, `nlQuery`, `narrative`, `nlpText`, `edaGenerate`, `edaGet`
    - Reuse the existing `request` helper (auth header, JSON body, error parsing)
    - _Requirements: 5.2_

  - [x] 5.2 Create `data_frontend/src/components/intelligence/IntelligenceErrorBanner.jsx`
    - Map `BEDROCK_NOT_CONFIGURED`, `LLM_RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `TOKEN_BUDGET_EXCEEDED`, `INTELLIGENCE_DISABLED`, and unknown codes to friendly copy per Requirement 13
    - Render `retryAfterSeconds` countdown when present
    - _Requirements: 13.2, 13.3, 13.4_

  - [x] 5.3 Create `data_frontend/src/components/intelligence/NLQueryBox.jsx`
    - Free-form input labelled "Ask a question about this dataset"
    - States `idle | loading | success | refused | error`
    - On `success` render narrative card, matched tool badge, parameters `<dl>`, and a result panel chosen by `intent.tool` (reuse existing analysis panels for `kmeans`, `regression`, `anomaly_detection`, `feature_importance`, `forecast`, `fft`; fall back to a small `<JsonPreview>` for the rest)
    - On `refused` render `suggestion` plus chips of `supportedTools` that pre-fill the input
    - On `error` render `IntelligenceErrorBanner`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.4 Mount `NLQueryBox` in `data_frontend/src/pages/Aiinsights.jsx`
    - Render the box above the existing fixed-template grid; both remain usable
    - Hide the box (graceful no-op) when no dataset is selected
    - _Requirements: 5.1_

  - [ ]* 5.5 Component tests for `NLQueryBox`
    - Cover idle/loading/success/refused/error states with a mocked fetch
    - Assert the matched tool badge and narrative render on success
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 6. Checkpoint — 5a NL Queries shippable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 5b Narrative Generation — backend
  - [x] 7.1 Implement `data_backend/services/narrativeService.js`
    - Export `generateNarrative({ dataset, userId, sections, tone })` defaulting `sections` to `["overview", "quality", "trends", "correlations", "outliers", "recommendations"]` and `tone` to `executive`
    - Cache key: `intelligence:narrative:${datasetId}:${sha1(sections.slice().sort().join('|') + '|' + tone)}` (sort makes the key order-independent)
    - On cache hit (TTL 300s) return cached payload without invoking Bedrock
    - If `dataset.stats` is missing, trigger the existing recompute pipeline before continuing
    - Build `Dataset_Context`; call `checkLlmBudget(userId)`; invoke Bedrock with `feature: 'narrative'`
    - Parse the response as `{ sections: { [name]: string } }`; reject with `INCOMPLETE_NARRATIVE` if any requested section is missing
    - Compose `fullMarkdown` by joining each section as `## {Title}\n\n{markdown}` in the requested order
    - Persist to `dataset.narrative = { sections, fullMarkdown, tone, model, generatedAt }` and `cacheSet(...)` for 300s
    - Return `{ sections, fullMarkdown, model, generatedAt }`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 7.2 Wire `POST /api/intelligence/:datasetId/narrative` in `routes/intelligence.js`
    - Apply `authMiddleware`, call `lookupDataset`, then `narrativeService.generateNarrative`
    - _Requirements: 6.1_

  - [ ]* 7.3 Property test P10 — narrative cache key is deterministic for equal inputs
    - **Property 10: Narrative cache key is deterministic for equal inputs**
    - **Validates: Requirements 6.8**
    - For arbitrary `datasetId`, two arbitrary permutations of the same `sections` array, and the same `tone`, the computed cache key is identical

  - [ ]* 7.4 Property test P11 — narrative response includes every requested section
    - **Property 11: Narrative response includes every requested section**
    - **Validates: Requirements 6.5**
    - For arbitrary requested `sections`, when the mocked Bedrock omits any section the service returns `INCOMPLETE_NARRATIVE`; when all are present the returned `sections` object has a value for every requested name

- [x] 8. 5b Narrative Generation — frontend
  - [x] 8.1 Create `data_frontend/src/lib/intelligenceMarkdown.js`
    - Whitelist-based mini-renderer: only `h1`–`h4`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `code`, `blockquote`, `a` (with `rel="nofollow"`)
    - Strip every other tag and every `on*` attribute; never insert `<script>` or `<iframe>`
    - Export `renderMarkdown(md): string` returning sanitised HTML for `dangerouslySetInnerHTML`

  - [ ]* 8.2 Property test — markdown renderer never emits `<script` or `<iframe`
    - **Property: Markdown renderer never emits `<script` or `<iframe`** (supplemental — supports Requirement 7.1 hardening)
    - For arbitrary input strings (including hostile HTML), the rendered output contains zero `<script` and zero `<iframe` substrings

  - [x] 8.3 Create `data_frontend/src/components/intelligence/NarrativePanel.jsx`
    - Reads `dataset.narrative` from `DatasetContext` if present; otherwise calls `intelligenceApi.narrative(datasetId, {})` once on mount
    - Tone toggle (`executive` / `technical`) and Regenerate button trigger a new POST with the selected tone
    - While loading, disable Regenerate and show an inline spinner
    - Renders the markdown via `intelligenceMarkdown.renderMarkdown`
    - On error renders `IntelligenceErrorBanner`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 8.4 Mount `NarrativePanel` in `data_frontend/src/pages/Reports.jsx`
    - Place above the existing Executive Summary panel; do not remove existing panels
    - _Requirements: 7.1_

  - [ ]* 8.5 Component tests for `NarrativePanel`
    - Cover initial load, regenerate, tone toggle, and error states with a mocked fetch

- [x] 9. Checkpoint — 5b Narratives shippable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 5c Text Column NLP — Python service
  - [x] 10.1 Add Python NLP dependencies
    - Append `nltk>=3.9` to `python_service/requirements.txt`
    - Update `python_service/Dockerfile` to run `python -m nltk.downloader vader_lexicon` at build time (also document a local-dev one-liner in a comment)
    - _Requirements: 8.2, 8.4, 8.5_

  - [x] 10.2 Create `python_service/intelligence/__init__.py` and `python_service/intelligence/nlp_pipeline.py`
    - Helpers: `vader_scores(texts)`, `lda_topics(texts, topic_count)`, `tfidf_keywords(texts, keyword_count)`
    - Sentiment thresholds: positive `> 0.05`, negative `< -0.05`, neutral otherwise
    - LDA built over a TF-IDF vectorisation; return each topic's top 8 terms with weights
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 10.3 Create `python_service/intelligence/nlp_routes.py`
    - `POST /intelligence/nlp/analyze` accepting `{ headers, rows, column, options? }`
    - Reject with `INSUFFICIENT_TEXT_DATA` when fewer than 10 non-empty values
    - Reject with `UNKNOWN_COLUMN` when `column` not in `headers`
    - Return the response shape from `design.md` § Python Service Modules
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 10.4 Register the NLP router in `python_service/main.py`
    - `app.include_router(nlp_router, prefix='/intelligence/nlp', tags=['intelligence'])`
    - Do not modify any existing endpoint
    - _Requirements: 8.1_

  - [ ]* 10.5 Property test P16 — NLP rejects insufficient text data (Python `hypothesis`)
    - **Property 16: NLP rejects insufficient text data**
    - **Validates: Requirements 8.6**
    - For arbitrary columns with fewer than 10 non-empty values, the route returns `INSUFFICIENT_TEXT_DATA` and the LDA/TF-IDF code paths are not entered (verify via spies)

  - [ ]* 10.6 Example tests for sentiment, topics, and keywords shape
    - Curated positive/negative/neutral inputs produce the expected aggregate counts
    - Topics list contains `topicCount` entries with non-empty `terms`
    - Keywords list is sorted descending by score
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [x] 11. 5c Text Column NLP — Node proxy and frontend
  - [x] 11.1 Add `nlpText` proxy in `data_backend/services/pythonBridge.js`
    - Export `nlpText(headers, rows, column, options)` that calls `/intelligence/nlp/analyze`
    - Reuse the existing `callPython` retry/timeout/error mapping; map `ECONNREFUSED` to `PYTHON_UNAVAILABLE`
    - _Requirements: 8.9_

  - [x] 11.2 Wire `POST /api/intelligence/:datasetId/nlp/text` in `routes/intelligence.js`
    - Apply `authMiddleware`, `lookupDataset`, sample rows up to a hard cap of 5_000 via the existing stratified-sample helper
    - Validate `column` is in `dataset.headers` else `UNKNOWN_COLUMN`
    - Call `pythonBridge.nlpText` and return its payload as-is
    - This route does NOT consume LLM budget
    - _Requirements: 8.9_

  - [x] 11.3 Create `data_frontend/src/components/intelligence/TextNlpPanel.jsx`
    - Per text column from `stats.textColumns`, render an "Analyze text" button
    - On click, call `intelligenceApi.nlpText(datasetId, { column })` and render a sentiment donut (reuse `DonutChart`), a topics list (chip groups of 8 terms), and a keyword table with score bars
    - On `INSUFFICIENT_TEXT_DATA` render the exact copy "This column does not have enough text to analyze (needs at least 10 non-empty rows)"
    - _Requirements: 9.1, 9.2, 9.4_

  - [x] 11.4 Mount `TextNlpPanel` in `data_frontend/src/pages/Aiinsights.jsx`
    - Render only when `stats.textColumns?.length > 0`; otherwise the existing fixed-template grid renders unchanged
    - _Requirements: 9.3_

  - [ ]* 11.5 Component tests for `TextNlpPanel`
    - Mocked fetch for happy path and `INSUFFICIENT_TEXT_DATA` path
    - _Requirements: 9.2, 9.4_

- [x] 12. Checkpoint — 5c Text NLP shippable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. 5d Automated EDA Reports — Python service
  - [x] 13.1 Add Python EDA dependencies
    - Append `ydata-profiling>=4.10` and `matplotlib>=3.9` to `python_service/requirements.txt`
    - Keep heavy imports inside the route handler so the service still boots if the package fails to install (return `PYTHON_UNAVAILABLE`)
    - _Requirements: 10.2, 10.3_

  - [x] 13.2 Create `python_service/intelligence/eda_pipeline.py`
    - Wrap `ProfileReport(df, minimal=True)` and convert the result to JSON
    - Render up to 12 plots (missing heatmap, correlation heatmap, top numeric distributions, top categorical distributions) at ≤ 800×600 px PNG, base64-encoded
    - Helper `stratified_sample(df, n)` for rows > 50_000
    - _Requirements: 10.2, 10.3, 10.5_

  - [x] 13.3 Create `python_service/intelligence/eda_routes.py`
    - `POST /intelligence/eda/profile` accepting `{ headers, rows, options? }` with `options.minimal` (default true) and `options.includePlots` (default true)
    - When rows > 50_000, stratified-sample down and report `samplingApplied: { applied: true, originalRowCount, sampledRowCount }`
    - Return `{ profile, plots, samplingApplied, elapsedMs }` per the design contract
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [x] 13.4 Register the EDA router in `python_service/main.py`
    - `app.include_router(eda_router, prefix='/intelligence/eda', tags=['intelligence'])`
    - _Requirements: 10.1_

  - [ ]* 13.5 Smoke test — small CSV produces a well-formed profile
    - Submit a tiny synthetic dataset and assert `profile`, `plots`, and `samplingApplied` keys are present
    - _Requirements: 10.2, 10.3_

  - [ ]* 13.6 Smoke test — sampling kicks in past 50k rows
    - Submit > 50_000 rows; assert `samplingApplied.applied === true` and `sampledRowCount <= 50_000`
    - _Requirements: 10.5_

- [x] 14. 5d Automated EDA Reports — Node orchestration
  - [x] 14.1 Add `edaProfile` proxy in `data_backend/services/pythonBridge.js`
    - Export `edaProfile(headers, rows, options)` that calls `/intelligence/eda/profile`
    - Map `ECONNREFUSED` to `PYTHON_UNAVAILABLE`
    - _Requirements: 10.6_

  - [x] 14.2 Implement EDA orchestration in `routes/intelligence.js`
    - `POST /api/intelligence/:datasetId/eda` flow:
      - Compute `etag = sha1(rowCount + '\u0000' + headers.join('\u0000'))`
      - If `dataset.edaReport.etag === etag`, return the persisted report
      - Else load rows (stratified-sample to 50_000), call `pythonBridge.edaProfile`
      - Build a `Dataset_Context` from the resulting profile and call `narrativeService.generateNarrative(..., sections=["overview","schema","quality","distributions","correlations","outliers","recommendations","next_steps"], tone="technical")`
      - Persist `dataset.edaReport = { etag, profile, plots, narrative, fullMarkdown, samplingApplied, generatedAt }`
      - Return `{ profile, plots, narrative, fullMarkdown, samplingApplied }`
    - `GET /api/intelligence/:datasetId/eda` returns the persisted report when its `etag` matches; otherwise 404 with code `EDA_NOT_GENERATED`
    - _Requirements: 10.6, 10.7, 10.8_

  - [ ]* 14.3 Property test P12 — EDA etag is stable for stable schemas
    - **Property 12: EDA etag is stable for stable schemas**
    - **Validates: Requirements 10.7, 10.8**
    - For arbitrary `(rowCount, headers)`, repeated `etag` calls return the same value; any change to `rowCount` or any header changes the value

- [x] 15. 5d Automated EDA Reports — frontend
  - [x] 15.1 Create `data_frontend/src/components/intelligence/EDAReportPanel.jsx`
    - "Generate EDA Report" button calls `intelligenceApi.edaGenerate(datasetId)`
    - On `GET` mount, hydrate from `intelligenceApi.edaGet(datasetId)` when an `etag`-matched report exists
    - During the call (up to 90 s) show a progress card with the message "Building EDA report — this can take up to 90 seconds" and an indeterminate progress bar
    - After completion render: narrative markdown (via `intelligenceMarkdown`), tables for `variables` / `missing` / `correlations`, and a grid of plot images
    - On error keep any previously generated report visible and render `IntelligenceErrorBanner`
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [x] 15.2 Mount `EDAReportPanel` in `data_frontend/src/pages/Reports.jsx`
    - Place below `NarrativePanel` and above the existing Executive Summary
    - _Requirements: 11.1_

  - [x] 15.3 Update `data_frontend/src/lib/pdfExport.js`
    - Change signature to `exportReportToPDF(dataset, options = { includeNarrative: true, includeEda: true }, filename)`
    - When `dataset.narrative.fullMarkdown` is present, append a "AI Narrative" page rendering the markdown text
    - When `dataset.edaReport` is present, append "EDA Narrative", "EDA Tables", and "EDA Plots" pages; embed plot data URIs via `pdf.addImage`
    - Preserve all existing pages and styling
    - _Requirements: 7.5, 11.3_

  - [x] 15.4 Update `Reports.jsx` Export PDF handler
    - Pass through the active dataset's `narrative` and `edaReport` to `exportReportToPDF`
    - _Requirements: 7.5, 11.3_

  - [ ]* 15.5 Component tests for `EDAReportPanel`
    - Mocked fetch for generate flow and cached-fetch flow
    - _Requirements: 11.1, 11.2_

- [x] 16. Checkpoint — 5d EDA Reports shippable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Cross-cutting — health endpoint, feature-flag short-circuit, integration smoke
  - [x] 17.1 Implement `GET /api/intelligence/health` in `routes/intelligence.js`
    - Return `{ bedrock: 'ok'|'error'|'disabled', python: 'ok'|'error', model }` based on a live probe
    - `bedrock` is `'disabled'` when `INTELLIGENCE_LAYER_ENABLED=false`, `'error'` on `BEDROCK_NOT_CONFIGURED`, otherwise a lightweight `invokeModel` ping with `feature: 'health'` and a short prompt — failures degrade to `'error'` without throwing
    - `python` calls `isPythonAvailable()` from `pythonBridge.js`
    - This endpoint always responds, even when the layer is disabled
    - _Requirements: 12.3_

  - [x] 17.2 Implement disabled-mode short-circuit middleware
    - Add a router-level middleware in `routes/intelligence.js` that, when `intelligenceConfig().enabled === false`, returns HTTP 503 with `{ code: 'INTELLIGENCE_DISABLED', message: 'Intelligence layer is disabled in this environment', retryable: false }` for every route except `GET /health`
    - The middleware must short-circuit before any Bedrock or Python call is attempted
    - _Requirements: 12.2_

  - [ ]* 17.3 Property test P15 — disabled mode short-circuits without external calls
    - **Property 15: Disabled mode short-circuits without external calls**
    - **Validates: Requirements 12.2**
    - With `INTELLIGENCE_LAYER_ENABLED=false`, for every route under `/api/intelligence/*` other than `/health`, the response is HTTP 503 with `code === 'INTELLIGENCE_DISABLED'`, and Bedrock and Python clients are never invoked (verify via spies)

  - [x] 17.4 Hook narrative + EDA invalidation into dataset recompute
    - In the existing recompute pipeline, clear `dataset.narrative` and `dataset.edaReport` (and remove their Redis cache keys) so the next read regenerates against the new schema/stats
    - _Requirements: 6.7, 10.8_

  - [ ]* 17.5 Integration smoke tests for `/api/intelligence/*`
    - Mock Bedrock with `aws-sdk-client-mock` and the Python service with a fetch shim
    - Cover: NL query happy path, NL query refusal, narrative cache hit, narrative cache miss, NLP text happy path, EDA generate then EDA cached read, health endpoint, disabled-mode short-circuit
    - _Requirements: 4.1, 6.1, 8.9, 10.6, 12.2, 12.3_

- [x] 18. Final checkpoint — full Intelligence Layer
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP. They cover property tests, unit tests, integration smoke tests, and component tests.
- Each task references granular sub-requirements for traceability.
- The slice order (5a → 5b → 5c → 5d) is reflected in checkpoint placement so partial completion still ships value.
- Properties P1–P17 from `design.md` are each assigned to the closest implementation task. The supplemental markdown-renderer property in 8.2 is not numbered in the design but defends Requirement 7.1 against injection.
- No new file, route, identifier, or environment-variable subsystem label uses `phase3`, `phase4`, or `phase5`. The legacy `data_backend/routes/phase3.js` and `data_backend/routes/phase4.js` are not modified by this feature.
- Default Bedrock model is `anthropic.claude-sonnet-4-20250514-v1:0`, configurable via `BEDROCK_MODEL_ID`.
