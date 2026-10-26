/* Optional local Ollama helper for semantic column matching.
   Ollama runs on the user's computer; Vercel only hosts this frontend. */
(function (global) {
  const defaults = {
    endpoint: 'http://127.0.0.1:11434',
    embeddingModel: 'embeddinggemma',
    reviewModel: 'qwen3:8b',
    timeoutMs: 30000
  };

  function config(overrides) { return Object.assign({}, defaults, overrides || {}); }
  async function request(path, body, options) {
    const cfg = config(options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(cfg.endpoint.replace(/\/$/, '') + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function health(options) {
    try { const data = await request('/api/version', null, options); return { ok: true, version: data.version }; }
    catch (error) { return { ok: false, error: error.message }; }
  }

  function columnText(column) {
    const samples = (column.values || []).filter(v => v !== null && v !== undefined && String(v).trim()).slice(0, 8);
    return [
      `File: ${column.fileName || 'Unknown'}`,
      `Sheet: ${column.sheetName || 'Unknown'}`,
      `Column: ${column.header || 'Unknown'}`,
      `Detected type: ${column.detectedType || 'unknown'}`,
      `Examples: ${samples.join(' | ')}`
    ].join('\n');
  }

  function cosine(a, b) {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
  }

  async function embedColumns(columns, options) {
    const cfg = config(options);
    const data = await request('/api/embed', {
      model: cfg.embeddingModel,
      input: columns.map(columnText)
    }, cfg);
    return data.embeddings;
  }

  async function rankCandidates(comparisonColumn, uploadColumns, options) {
    const all = [comparisonColumn].concat(uploadColumns);
    const vectors = await embedColumns(all, options);
    return uploadColumns.map((column, index) => ({
      column,
      semanticScore: cosine(vectors[0], vectors[index + 1])
    })).sort((a, b) => b.semanticScore - a.semanticScore);
  }

  async function reviewMatch(comparisonColumn, candidates, options) {
    const cfg = config(options);
    const schema = {
      type: 'object',
      properties: {
        decision: { type: 'string', enum: ['match', 'none', 'manual_review'] },
        selectedSourceColumnId: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
        semanticRisk: { type: 'boolean' }
      },
      required: ['decision', 'selectedSourceColumnId', 'confidence', 'reason', 'semanticRisk']
    };
    const prompt = `You validate spreadsheet column mappings. Business meaning matters more than similar values. Never equate purchase, depreciation, discount, arrival, delivery, created, updated, start, end, active, or terminated unless their meanings truly match.\n\nCOMPARISON COLUMN\n${columnText(comparisonColumn)}\n\nUPLOAD CANDIDATES\n${candidates.slice(0, 5).map((x, i) => `${i + 1}. ID=${x.column.id}\n${columnText(x.column)}\nDeterministic score=${x.score ?? 'n/a'}; embedding score=${x.semanticScore ?? 'n/a'}`).join('\n\n')}\n\nReturn only schema-valid JSON.`;
    const data = await request('/api/chat', {
      model: cfg.reviewModel,
      stream: false,
      format: schema,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0 }
    }, cfg);
    return JSON.parse(data.message.content);
  }

  async function improveMappings(baseMappings, uploadColumns, comparisonColumns, options) {
    const uploadById = new Map(uploadColumns.map(c => [c.id, c]));
    const comparisonById = new Map(comparisonColumns.map(c => [c.id, c]));
    const output = [];
    for (const mapping of baseMappings) {
      if ((mapping.score || 0) >= 0.88 && !mapping.warning) { output.push(mapping); continue; }
      const comparison = comparisonById.get(mapping.comparisonColumnId);
      if (!comparison) { output.push(mapping); continue; }
      const ranked = await rankCandidates(comparison, uploadColumns, options);
      const candidates = ranked.slice(0, 5).map(item => ({
        column: item.column,
        semanticScore: item.semanticScore,
        score: item.column.id === mapping.sourceColumnId ? mapping.score : null
      }));
      const review = await reviewMatch(comparison, candidates, options);
      output.push(Object.assign({}, mapping, {
        aiReview: review,
        aiSuggestedSourceColumn: review.selectedSourceColumnId ? uploadById.get(review.selectedSourceColumnId) || null : null,
        status: review.decision === 'match' && review.confidence >= 0.88 && !review.semanticRisk ? 'ai_suggested' : 'review_required'
      }));
    }
    return output;
  }

  global.OllamaColumnMatcher = { health, columnText, embedColumns, rankCandidates, reviewMatch, improveMappings, defaults };
})(typeof window !== 'undefined' ? window : globalThis);
