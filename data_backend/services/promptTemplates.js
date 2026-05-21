/**
 * Prompt Templates — Intelligence Layer
 *
 * Pure functions that return Anthropic-style role-tagged message arrays.
 * No side effects, no I/O, no external dependencies.
 *
 * Each function returns an array of { role, content } objects suitable for
 * the `messages` field of an Anthropic Messages API request.
 */

// ─── 5a — Natural Language Query ─────────────────────────────────────────────

/**
 * Build messages for the tool-selection step of a natural language query.
 *
 * The model is instructed to map the user's question to one of the registered
 * analysis tools and return a structured AnalysisIntent JSON object, or null
 * if no tool fits.
 *
 * @param {object} context - Dataset_Context object from datasetContext.js
 * @param {string} question - The user's plain-English question
 * @param {Array<{ tool: string, description: string, parameterSchemaJson: object }>} catalogue
 * @returns {Array<{ role: string, content: string }>}
 */
export function nlQueryMessages(context, question, catalogue) {
  const toolList = catalogue
    .map(t => `- ${t.tool}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameterSchemaJson)}`)
    .join('\n');

  const systemContent = `You are a data analysis assistant. Your job is to map a user's question to the most appropriate analysis tool.

Dataset_Context contains: schema (column types, headers, row count), quality flags, numeric and categorical stats, correlation insights, and a small sample of redacted rows.

Available tools:
${toolList}

Respond with ONLY a JSON object matching this shape:
{
  "tool": "<tool_id>",
  "parameters": { <tool parameters> },
  "columns": ["<column names referenced>"],
  "rationale": "<1-2 sentence explanation, max 300 chars>"
}

If no tool fits the question, respond with ONLY the JSON value null.

The JSON must be directly parseable — do not wrap it in markdown code fences or add any other text.`;

  const userContent = `Dataset context:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`;

  return [
    { role: 'user', content: `<system>\n${systemContent}\n</system>\n\n${userContent}` },
  ];
}

/**
 * Build messages for the narrative step of a natural language query.
 *
 * The model is instructed to summarise the analysis result in 1–3 plain
 * English sentences.
 *
 * @param {{ tool: string, parameters: object }} intent
 * @param {unknown} resultSummary - The analysis result (or a trimmed summary of it)
 * @returns {Array<{ role: string, content: string }>}
 */
export function nlQueryNarrative(intent, resultSummary) {
  const systemContent = `You are a data analyst. Summarise the following analysis result in 1-3 plain English sentences. Be concise and specific. Do not use markdown.`;

  const userContent = `Analysis: ${intent.tool}\nParameters: ${JSON.stringify(intent.parameters)}\nResult summary: ${JSON.stringify(resultSummary)}`;

  return [
    { role: 'user', content: `<system>\n${systemContent}\n</system>\n\n${userContent}` },
  ];
}

// ─── 5b — Report Narrative ────────────────────────────────────────────────────

/**
 * Build messages for multi-section report narrative generation.
 *
 * The model is instructed to write a data analysis narrative in the specified
 * tone and return a JSON object with one markdown string per requested section.
 *
 * @param {object} context - Dataset_Context object
 * @param {string[]} sections - Section names to generate (e.g. ["overview", "quality"])
 * @param {'executive' | 'technical'} tone
 * @returns {Array<{ role: string, content: string }>}
 */
export function narrativeMessages(context, sections, tone) {
  const toneGuide = tone === 'technical'
    ? 'Use data-driven language with specific numbers. Keep it precise and actionable.'
    : 'Use business-friendly language. Focus on impact and decisions. No jargon.';

  const systemContent = `You are a senior data analyst creating a stakeholder-ready report. ${toneGuide}

═══ CRITICAL RULES ═══
1. CONSISTENCY: Record counts, feature counts, and statistics MUST match across all sections. Do not contradict yourself. If you state "690,000 records" in Overview, every other section must reference the same number.
2. CORRELATION THRESHOLD: Do NOT generate business conclusions from correlations with |r| < 0.10. Instead write: "Very weak relationship (r = X). Avoid interpretation."
3. FORMAT: Replace all narrative paragraphs with structured triplets:
   - **Observation:** what the data shows
   - **Why it matters:** business context
   - **Suggested action:** specific next step
4. INSIGHTS DASHBOARD: The "insights" section must categorize findings as:
   🟢 Positive findings
   🟡 Neutral/monitoring items
   🔴 Risk areas requiring action
5. NO FILLER: Never write "further investigation required" or "warrants deeper analysis". Always specify WHAT to investigate, HOW, and WHO should do it.

═══ REPORT STRUCTURE ═══

## Overview
- 3-4 bullet KPIs with values
- One sentence on dataset scope

## Insights
🟢 **Positive:**
- (list positive findings)

🟡 **Neutral:**
- (list neutral observations)

🔴 **Risks:**
- (list risk areas with severity)

## Quality
| Issue | Severity | Impact | Recommendation |
|-------|----------|--------|----------------|
Include: missing data, low cardinality, format issues, identifier problems

## Trends
For top 3-4 variables:
**Variable Name** (mean: X, range: Y-Z)
- **Observation:** distribution shape, time trends, and characteristics
- **Why it matters:** business context
- **Suggested action:** what to do with this information

## Correlations
| Variables | r | Strength | Interpretation |
|-----------|---|----------|----------------|
ONLY include |r| >= 0.10 with business interpretation.
For ALL correlations with |r| < 0.10, write ONE line: "All other correlations are below |0.10| — too weak for business conclusions."

## Outliers
For each:
- **Observation:** what outlier was detected
- **Why it matters:** potential data quality or business issue
- **Suggested action:** specific validation step

## Recommendations
**Immediate (1-2 weeks):**
- specific action items

**Medium-term (1-3 months):**
- deeper analysis items

**Long-term (3-12 months):**
- strategic changes

═══ WRITING RULES ═══
- NO paragraphs longer than 2 lines
- Bullets and tables ONLY
- No repeated statistics across sections
- Each section: 80-200 words max
- Skimmable in under 2 minutes

Respond with ONLY a JSON object:
{
  "sections": {
    "overview": "<markdown text>",
    "insights": "<markdown text>",
    "quality": "<markdown text>",
    "trends": "<markdown text>",
    "correlations": "<markdown text>",
    "outliers": "<markdown text>",
    "recommendations": "<markdown text>"
  }
}
The section keys MUST exactly match the requested section names. No code fences, no extra text.`;

  const userContent = `Dataset context:\n${JSON.stringify(context, null, 2)}\n\nWrite sections: ${sections.join(', ')}`;

  return [
    { role: 'user', content: `<system>\n${systemContent}\n</system>\n\n${userContent}` },
  ];
}

// ─── 5d — EDA Narrative ───────────────────────────────────────────────────────

/**
 * Build messages for the EDA report narrative.
 *
 * The model is instructed to write a technical EDA narrative based on a
 * ydata-profiling summary and return a JSON object with one markdown string
 * per requested section.
 *
 * @param {object} profileSummary - Trimmed ydata-profiling JSON output
 * @param {string[]} sections - Section names to generate
 * @returns {Array<{ role: string, content: string }>}
 */
export function edaNarrativeMessages(profileSummary, sections) {
  const systemContent = `You are a senior data scientist creating a professional EDA report.

═══ CRITICAL RULES ═══
1. CONSISTENCY: All numbers (rows, columns, percentages) must be consistent across every section. Never contradict yourself.
2. CORRELATION THRESHOLD: Do NOT draw business conclusions from |r| < 0.10. Write: "Very weak relationship (r = X). Avoid interpretation."
3. FORMAT: Every finding must use:
   - **Observation:** factual data point
   - **Why it matters:** business relevance
   - **Suggested action:** specific step (never "investigate further")
4. INSIGHTS: Categorize all findings with 🟢 🟡 🔴 severity indicators.
5. CHARTS: For each visualization mentioned, include one-line explanation of what it reveals.

═══ REPORT STRUCTURE ═══

## Overview
- Dataset: X rows × Y columns, Z MB
- Key stats in 3-4 bullets

## Insights
🟢 **Positive:**
- findings that indicate healthy data or operations

🟡 **Neutral:**
- observations requiring monitoring

🔴 **Risks:**
- issues requiring immediate action

## Schema
| Column | Type | Unique | Notes |
|--------|------|--------|-------|

## Quality
| Issue | Severity | Impact | Fix |
|-------|----------|--------|-----|

## Distributions
**Variable** — Shape, Mean, Std
- **Observation:** what it shows
- **Why it matters:** context
- **Suggested action:** next step

## Correlations
| Pair | r | Assessment |
|------|---|------------|
ONLY include |r| >= 0.10 with interpretation.
For ALL weaker correlations: "Remaining correlations are below |0.10| — insufficient for business conclusions."

## Outliers
- **Observation:** outlier detected in X
- **Why it matters:** impact
- **Suggested action:** validation step

## Recommendations
**Immediate (1-2 weeks):** actionable items
**Medium-term (1-3 months):** analysis items
**Long-term (3-12 months):** strategic items

## Next Steps
1. Data prep → 2. Feature engineering → 3. Hypothesis testing → 4. Modeling

═══ RULES ═══
- Bullets and tables ONLY — zero paragraphs
- 50-150 words per section
- Lead with most important finding
- Specific actions always (WHAT, HOW, WHO)

Respond with ONLY valid JSON:
{
  "sections": {
    "<section_name>": "<markdown>"
  }
}`;

  const userContent = `Profile summary:\n${JSON.stringify(profileSummary, null, 2)}\n\nWrite sections: ${sections.join(', ')}`;

  return [
    { role: 'user', content: `<system>\n${systemContent}\n</system>\n\n${userContent}` },
  ];
}
