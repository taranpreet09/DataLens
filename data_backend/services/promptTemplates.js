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
    ? 'Write in a detailed, statistical style suitable for data scientists. Include specific numbers, statistical terms, and methodological notes.'
    : 'Write in a business-friendly style suitable for executives. Focus on key insights and actionable findings. Avoid jargon.';

  const systemContent = `You are a data analysis expert writing a report narrative. ${toneGuide}

Respond with ONLY a JSON object in this exact shape:
{
  "sections": {
    "<section_name>": "<markdown text for that section>"
  }
}

Include every section listed in the user message. Do not add extra keys. The JSON must be directly parseable — no markdown code fences or surrounding text.`;

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
  const systemContent = `You are a data scientist writing a technical Exploratory Data Analysis (EDA) narrative based on a ydata-profiling report summary.

Write in a detailed, technical style. Reference specific statistics, distributions, and data quality findings from the profile.

Respond with ONLY a JSON object in this exact shape:
{
  "sections": {
    "<section_name>": "<markdown text for that section>"
  }
}

Include every section listed in the user message. Do not add extra keys. The JSON must be directly parseable — no markdown code fences or surrounding text.`;

  const userContent = `Profile summary:\n${JSON.stringify(profileSummary, null, 2)}\n\nWrite sections: ${sections.join(', ')}`;

  return [
    { role: 'user', content: `<system>\n${systemContent}\n</system>\n\n${userContent}` },
  ];
}
