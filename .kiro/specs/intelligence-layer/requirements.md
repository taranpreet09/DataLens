# Requirements Document

## Introduction

The Intelligence Layer adds LLM-powered capabilities on top of the existing Obsidian Analytics platform. It is delivered as four sub-features that can ship independently:

- **5a — Natural Language Queries (#31, Node/TS):** users ask questions in plain English; the system parses intent, dispatches the matching existing analysis (Phase 1–4), and returns the result with a short explanation.
- **5b — Auto-Generated Report Narratives (#32, Node/TS):** the system produces a multi-paragraph executive narrative for a dataset by summarising pre-computed stats through an LLM, rendered as markdown and exportable via the existing PDF path.
- **5c — Text Column NLP (#33, Python):** sentiment scores, topic clusters, and keywords are computed for text columns using classical NLP (NLTK + scikit-learn) and surfaced in the analysis UI.
- **5d — Automated EDA Reports (#34, Python):** a one-click report generator that runs `ydata-profiling` over the active dataset, layers an LLM-authored narrative on top, and returns markdown + plot images that render in-app and export to PDF.

All four sub-features share a single LLM gateway: Amazon Bedrock with Anthropic Claude Sonnet 4 (`anthropic.claude-sonnet-4-20250514-v1:0`) as the default model, configurable per-feature via environment variables. Privacy posture is metadata-first: only schema, column profiles, pre-computed stats, and small samples (≤ 10 rows) are sent to Bedrock; raw row data is never sent in bulk.

> **File and route naming constraint.** All new modules and routes for the Intelligence Layer use feature-descriptive names. The legacy file `data_backend/routes/phase3.js` is *not* a template for new naming. New code MUST NOT use the tokens `phase3`, `phase4`, or `phase5` in file names, route paths, identifiers, or service module names. The Node routes live under `/api/intelligence/*` and the Python service routes live under `/intelligence/nlp/*` and `/intelligence/eda/*`.

## Glossary

- **Intelligence_Layer**: The collective system covering features 5a through 5d.
- **NL_Query_Service**: Backend service (`data_backend/services/nlQueryService.js`) that translates a natural-language question into a structured `AnalysisIntent`.
- **AnalysisIntent**: A JSON object of the form `{ tool: string, parameters: object, columns: string[], rationale: string }` emitted by the LLM, validated against an allow-list of registered tools.
- **Tool_Registry**: An in-process registry mapping `tool` identifiers (e.g. `kmeans`, `regression`, `correlation`) to existing analysis engine handlers and their parameter schemas (Zod).
- **Narrative_Service**: Backend service (`data_backend/services/narrativeService.js`) that turns a dataset's pre-computed `stats` object into a structured markdown narrative.
- **Bedrock_Client**: Backend module (`data_backend/services/bedrockClient.js`) that wraps the AWS Bedrock Runtime SDK, handles retries, timeouts, and redaction.
- **NLP_Service**: Python FastAPI endpoints (`/intelligence/nlp/*`) that compute sentiment, topics, and keywords for a text column.
- **EDA_Service**: Python FastAPI endpoint (`/intelligence/eda/profile`) that runs `ydata-profiling` and returns a JSON profile plus base64-encoded plot images.
- **Dataset_Context**: The minimum payload sent to Bedrock for a request: `{ schema, qualityFlags, numericStats, categoricalStats, timeSeries?, correlationInsights?, sampleRows: ≤10 }`.
- **Token_Budget**: A configured maximum number of input tokens per LLM call (default 12,000), enforced before send.
- **Sample_Row**: A single row from the dataset, optionally redacted, included in `Dataset_Context`.

## Requirements

### Requirement 1: Bedrock Gateway

**User Story:** As a backend developer, I want a single Bedrock gateway module, so that all four sub-features share consistent auth, retry, timeout, and redaction behaviour.

#### Acceptance Criteria

1. THE Bedrock_Client SHALL expose an `invokeModel(messages, options)` function that accepts a list of role-tagged messages and returns the assistant's text response.
2. WHERE `BEDROCK_MODEL_ID` is set, THE Bedrock_Client SHALL use that model identifier; otherwise THE Bedrock_Client SHALL default to `anthropic.claude-sonnet-4-20250514-v1:0`.
3. WHERE `AWS_REGION` is set, THE Bedrock_Client SHALL use that region; otherwise THE Bedrock_Client SHALL default to `us-east-1`.
4. WHEN a Bedrock invocation exceeds 60 seconds, THE Bedrock_Client SHALL abort the request and return an error with code `BEDROCK_TIMEOUT`.
5. IF Bedrock returns a throttling or 5xx error, THEN THE Bedrock_Client SHALL retry up to 3 times with exponential backoff starting at 500ms.
6. IF AWS credentials are not configured, THEN THE Bedrock_Client SHALL return an error with code `BEDROCK_NOT_CONFIGURED` and a message naming the missing environment variables.
7. WHEN an LLM-bound payload exceeds the configured Token_Budget, THE Bedrock_Client SHALL reject the call with code `TOKEN_BUDGET_EXCEEDED` before contacting Bedrock.
8. THE Bedrock_Client SHALL emit a structured log entry per call recording `feature`, `model_id`, `input_tokens_estimate`, `latency_ms`, and `outcome`, without logging any `Sample_Row` content.

### Requirement 2: Privacy and Data Minimisation

**User Story:** As a data owner, I want strict control over what dataset content reaches Bedrock, so that sensitive rows do not leak.

#### Acceptance Criteria

1. THE Intelligence_Layer SHALL construct every Bedrock request from a `Dataset_Context` containing only schema, column profiles, pre-computed stats, and at most 10 `Sample_Row` entries.
2. THE Intelligence_Layer SHALL never include more than 10 raw rows in any LLM-bound payload.
3. WHEN building `Dataset_Context`, THE Intelligence_Layer SHALL truncate any string field longer than 200 characters to 200 characters followed by `…`.
4. WHERE a column has been classified by the existing semantic-type detector as `email`, `phone`, or `creditcard`, THE Intelligence_Layer SHALL replace each cell value with the literal token `[REDACTED]` in `Sample_Row` entries.
5. THE Intelligence_Layer SHALL refuse any Bedrock request whose serialised input exceeds 200 KB and return error code `PAYLOAD_TOO_LARGE`.
6. THE Intelligence_Layer SHALL not write any user-supplied prompt, dataset content, or LLM response to persistent storage other than the dataset-scoped result records described in Requirement 4 and Requirement 6.

### Requirement 3: Tool Registry for NL Queries

**User Story:** As a backend developer, I want a single registry that lists every analysis the NL_Query_Service can dispatch to, so that the LLM cannot invoke arbitrary or unsupported operations.

#### Acceptance Criteria

1. THE Tool_Registry SHALL register at least the following tools, each backed by an existing handler: `descriptive_stats`, `correlation`, `regression`, `kmeans`, `feature_importance`, `anomaly_detection`, `forecast`, `fft`, `t_test`, `anova`, `chi_square`, `normality`, `confidence_intervals`.
2. THE Tool_Registry SHALL define a Zod parameter schema for each tool that mirrors the existing route's request body.
3. WHEN an `AnalysisIntent` is dispatched, THE NL_Query_Service SHALL validate `intent.tool` against the registry and reject unknown tools with error code `UNKNOWN_TOOL`.
4. WHEN an `AnalysisIntent` is dispatched, THE NL_Query_Service SHALL validate `intent.parameters` against the registered Zod schema and reject invalid parameters with error code `INVALID_PARAMETERS` and a list of validation errors.
5. WHERE the registered tool requires column references, THE NL_Query_Service SHALL verify every referenced column exists in the active dataset's headers and reject missing columns with error code `UNKNOWN_COLUMN`.

### Requirement 4: Natural Language Query Endpoint (5a)

**User Story:** As an analyst, I want to ask "show me the correlation between price and rating" in plain English, so that I do not have to navigate to the right analysis page.

#### Acceptance Criteria

1. THE NL_Query_Service SHALL expose `POST /api/intelligence/:datasetId/nl-query` accepting `{ question: string }` and protected by the existing `authMiddleware`.
2. WHEN a request is received, THE NL_Query_Service SHALL build a `Dataset_Context` for the target dataset and submit it together with the user question and the Tool_Registry catalogue to the Bedrock_Client.
3. THE NL_Query_Service SHALL instruct the LLM to respond with a JSON object matching the `AnalysisIntent` shape `{ tool, parameters, columns, rationale }`.
4. WHEN the LLM response is received, THE NL_Query_Service SHALL parse it as JSON and reject non-JSON responses with error code `INTENT_PARSE_ERROR`.
5. WHEN a parsed `AnalysisIntent` passes Tool_Registry validation, THE NL_Query_Service SHALL invoke the registered handler and return `{ intent, result, narrative, executionTimeMs }`.
6. THE NL_Query_Service SHALL produce a follow-up `narrative` of 1 to 3 sentences summarising the analysis result in plain English.
7. IF the LLM declines to map the question to any tool, THEN THE NL_Query_Service SHALL return `{ intent: null, suggestion: string, supportedTools: string[] }` with HTTP status 200.
8. THE NL_Query_Service SHALL complete a single request within 30 seconds at the 95th percentile when the underlying analysis runs in under 10 seconds.
9. WHEN a question contains fewer than 3 characters or more than 500 characters, THE NL_Query_Service SHALL reject the request with error code `INVALID_QUESTION_LENGTH`.

### Requirement 5: NL Query Frontend Surface

**User Story:** As an analyst, I want a chat-style input on the AI Insights page, so that I can ask free-form questions without leaving my workflow.

#### Acceptance Criteria

1. THE Aiinsights page SHALL render an input field labelled "Ask a question about this dataset" alongside the existing fixed-template question grid.
2. WHEN a user submits a free-form question, THE Aiinsights page SHALL call `POST /api/intelligence/:datasetId/nl-query` and display a loading state until the response returns.
3. WHEN the response contains a non-null `intent`, THE Aiinsights page SHALL render the narrative, the matched tool name, the parameters used, and a result panel reusing the existing analysis components where applicable.
4. WHEN the response `intent` is null, THE Aiinsights page SHALL display the `suggestion` text and a list of supported question categories.
5. IF the request fails, THEN THE Aiinsights page SHALL display the error message returned by the backend without exposing stack traces.

### Requirement 6: Narrative Generation Endpoint (5b)

**User Story:** As an analyst preparing a report, I want an executive narrative auto-written from the dataset's stats, so that I can paste it into the report instead of writing it myself.

#### Acceptance Criteria

1. THE Narrative_Service SHALL expose `POST /api/intelligence/:datasetId/narrative` accepting `{ sections?: string[], tone?: "executive" | "technical" }` and protected by `authMiddleware`.
2. WHEN no `sections` are supplied, THE Narrative_Service SHALL default to the sections `["overview", "quality", "trends", "correlations", "outliers", "recommendations"]`.
3. WHEN the dataset's pre-computed `stats` object is missing, THE Narrative_Service SHALL trigger a recompute via the existing analysis service before invoking Bedrock.
4. THE Narrative_Service SHALL submit the `Dataset_Context` and the requested section list to the Bedrock_Client and instruct the model to return a JSON object `{ sections: { [name]: string } }` where each value is markdown text.
5. WHEN the LLM response is received, THE Narrative_Service SHALL validate that every requested section is present and reject responses with missing sections with error code `INCOMPLETE_NARRATIVE`.
6. THE Narrative_Service SHALL return `{ sections, fullMarkdown, model, generatedAt }` where `fullMarkdown` is the sections concatenated under H2 headings.
7. THE Narrative_Service SHALL persist the latest narrative against the dataset record (`dataset.narrative`) so subsequent reads do not require regeneration.
8. WHEN the same dataset narrative is requested twice within 5 minutes with identical `sections` and `tone`, THE Narrative_Service SHALL return the cached result rather than re-invoking Bedrock.

### Requirement 7: Narrative Frontend Surface

**User Story:** As an analyst, I want the Reports page to show the auto-generated narrative and let me regenerate it on demand, so that I always have a current summary.

#### Acceptance Criteria

1. THE Reports page SHALL render an "AI Narrative" panel containing the persisted narrative markdown for the active dataset.
2. WHILE a narrative request is in flight, THE Reports page SHALL display a loading indicator and disable the Regenerate control.
3. THE Reports page SHALL provide a Regenerate control that calls `POST /api/intelligence/:datasetId/narrative` and replaces the panel content with the new result.
4. THE Reports page SHALL provide a tone toggle with values `executive` and `technical` that is sent as the `tone` parameter on regenerate.
5. WHEN the user exports the report to PDF, THE Reports page SHALL include the rendered narrative markdown in the exported PDF in the order it appears on screen.

### Requirement 8: Text NLP Endpoint (5c)

**User Story:** As an analyst with a free-text column (e.g. customer reviews), I want sentiment, topics, and keywords surfaced automatically, so that I can understand what is in the column without reading every row.

#### Acceptance Criteria

1. THE NLP_Service SHALL expose `POST /intelligence/nlp/analyze` accepting `{ headers, rows, column, options? }` where `options` may include `{ topicCount?: number, keywordCount?: number, sampleSize?: number }`.
2. WHEN invoked, THE NLP_Service SHALL compute, for the specified column, a per-row sentiment score in the range -1.0 to 1.0 using NLTK VADER.
3. THE NLP_Service SHALL aggregate sentiment into `{ positive, neutral, negative }` counts using thresholds `> 0.05`, `[-0.05, 0.05]`, and `< -0.05` respectively.
4. THE NLP_Service SHALL compute up to `topicCount` topics (default 5) using scikit-learn `LatentDirichletAllocation` over a TF-IDF vectorisation of the column, returning each topic's top 8 terms and weight.
5. THE NLP_Service SHALL compute up to `keywordCount` keywords (default 20) for the whole column using TF-IDF, returning each keyword and its score.
6. IF the column has fewer than 10 non-empty values, THEN THE NLP_Service SHALL return error code `INSUFFICIENT_TEXT_DATA`.
7. IF `column` is not present in `headers`, THEN THE NLP_Service SHALL return error code `UNKNOWN_COLUMN`.
8. THE NLP_Service SHALL complete a request of up to 5,000 rows within 30 seconds at the 95th percentile.
9. THE Node backend SHALL expose `POST /api/intelligence/:datasetId/nlp/text` that proxies the call through the existing `pythonBridge.js` pattern, sampling at most 5,000 rows.

### Requirement 9: Text NLP Frontend Surface

**User Story:** As an analyst, I want NLP results visible on the Data Explorer or Analysis Lab for any text column, so that I can drill into qualitative data alongside the numeric profile.

#### Acceptance Criteria

1. THE Aiinsights page SHALL detect text columns from `stats.textColumns` and offer a per-column "Analyze text" action.
2. WHEN the user invokes "Analyze text" on a column, THE Aiinsights page SHALL call `POST /api/intelligence/:datasetId/nlp/text` and render a panel containing a sentiment donut, a topics list, and a keywords cloud or table.
3. WHEN no text columns are present, THE Aiinsights page SHALL hide the text NLP action and display the existing fixed-template grid unchanged.
4. IF the request returns `INSUFFICIENT_TEXT_DATA`, THEN THE Aiinsights page SHALL display the message "This column does not have enough text to analyze (needs at least 10 non-empty rows)".

### Requirement 10: Automated EDA Report Endpoint (5d)

**User Story:** As an analyst onboarding a new dataset, I want a one-click EDA report covering stats and plots, so that I do not have to run a dozen analyses manually to understand it.

#### Acceptance Criteria

1. THE EDA_Service SHALL expose `POST /intelligence/eda/profile` accepting `{ headers, rows, options? }` where `options` may include `{ minimal?: boolean, includePlots?: boolean }`.
2. WHEN invoked, THE EDA_Service SHALL run `ydata-profiling` in `minimal=true` mode by default to produce a profile JSON containing per-column stats, correlations, missing-data analysis, and duplicate detection.
3. WHERE `includePlots` is `true`, THE EDA_Service SHALL render up to 12 plot images at most 800×600 pixels as PNG and return them base64-encoded under `plots: { [plotKey]: dataUri }`.
4. THE EDA_Service SHALL complete a profile of up to 20,000 rows within 90 seconds at the 95th percentile.
5. IF the dataset exceeds 50,000 rows, THEN THE EDA_Service SHALL stratified-sample down to 50,000 rows before profiling and report the sampling in the response field `samplingApplied`.
6. THE Node backend SHALL expose `POST /api/intelligence/:datasetId/eda` that calls EDA_Service via `pythonBridge.js`, then submits the resulting profile summary as a `Dataset_Context` to the Narrative_Service to obtain an "EDA narrative" of 4 to 8 markdown sections.
7. THE Node backend SHALL return `{ profile, plots, narrative, fullMarkdown, samplingApplied }` and persist the result against the dataset record under `dataset.edaReport` keyed by an `etag` derived from row count and headers.
8. WHEN an EDA report exists for the dataset and its `etag` matches the current dataset state, THE Node backend SHALL serve the persisted report on `GET /api/intelligence/:datasetId/eda` rather than recomputing.

### Requirement 11: EDA Frontend Surface

**User Story:** As an analyst, I want a dedicated "Auto EDA" page or panel that renders the report and lets me export it to PDF, so that I can share the report with stakeholders.

#### Acceptance Criteria

1. THE Reports page SHALL provide a "Generate EDA Report" action that calls `POST /api/intelligence/:datasetId/eda` and renders the result inline.
2. THE Reports page SHALL render the EDA narrative as markdown, the per-column stats as tables, and each plot image inline.
3. WHEN the user exports the report to PDF, THE Reports page SHALL include the EDA narrative, stats tables, and plot images in the exported PDF.
4. WHILE an EDA report request is in flight, THE Reports page SHALL display a progress indicator with the message "Building EDA report — this can take up to 90 seconds".
5. IF the request fails, THEN THE Reports page SHALL display the backend error message and keep any previously generated report visible.

### Requirement 12: Configuration and Operability

**User Story:** As an operator, I want to configure Bedrock and Python NLP behaviour without code changes, so that I can tune cost, latency, and capability per environment.

#### Acceptance Criteria

1. THE Intelligence_Layer SHALL read the following environment variables on startup: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_MODEL_ID`, `BEDROCK_TOKEN_BUDGET`, `BEDROCK_TIMEOUT_MS`, `INTELLIGENCE_LAYER_ENABLED`.
2. WHERE `INTELLIGENCE_LAYER_ENABLED` is `false`, THE Node backend SHALL respond to every `/api/intelligence/*` route with HTTP 503 and the message "Intelligence layer is disabled in this environment".
3. THE Intelligence_Layer SHALL expose `GET /api/intelligence/health` that returns `{ bedrock: "ok"|"error"|"disabled", python: "ok"|"error", model: string }` based on a live probe.
4. THE Node backend SHALL apply the existing `apiLimiter` rate limit to all `/api/intelligence/*` routes plus a per-user limit of 30 LLM invocations per hour, rejecting excess requests with HTTP 429 and code `LLM_RATE_LIMITED`.
5. THE Intelligence_Layer SHALL log every LLM invocation with `userId`, `datasetId`, `feature`, `model`, `inputTokensEstimate`, `outputTokensEstimate`, `latencyMs`, and `outcome`, omitting any prompt or response body.

### Requirement 13: Error Handling and User Feedback

**User Story:** As a user, I want clear, actionable feedback when the Intelligence Layer cannot complete a request, so that I know whether to retry, adjust input, or contact an operator.

#### Acceptance Criteria

1. WHEN any Phase 5 endpoint returns an error, THE Intelligence_Layer SHALL include `{ code: string, message: string, retryable: boolean }` in the response body.
2. IF the error code is `BEDROCK_NOT_CONFIGURED` or HTTP status is 503, THEN THE frontend SHALL render the message "AI features are not configured for this environment" and hide regenerate controls.
3. IF the error code is `LLM_RATE_LIMITED`, THEN THE frontend SHALL render the retry-after duration when present and disable regenerate controls until the timer expires.
4. IF the error code is `PAYLOAD_TOO_LARGE` or `TOKEN_BUDGET_EXCEEDED`, THEN THE frontend SHALL render the message "This dataset is too large for AI analysis" and offer to retry with a smaller sample.
