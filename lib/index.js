// src/period.ts
var PRICING_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
var BEIJING_OFFSET = 8 * 60 * 60 * 1e3;
var DAY = 24 * 60 * 60 * 1e3;
var HOUR = 60 * 60 * 1e3;

// src/pricing.ts
var PRICING_ENDPOINT = "dsh-fg/pricing";
var PRICE_TTL = 6 * 60 * 60 * 1e3;
var PRICE_ROWS = [
  { key: "inputHit", label: "\u8F93\u5165 \xB7 \u7F13\u5B58\u547D\u4E2D", explanation: "\u91CD\u590D\u8F93\u5165\u4E2D\u547D\u4E2D DeepSeek \u4E0A\u4E0B\u6587\u7F13\u5B58\u7684\u90E8\u5206\uFF0C\u6309\u6B64\u5355\u4EF7\u8BA1\u8D39\u3002" },
  { key: "inputMiss", label: "\u8F93\u5165 \xB7 \u7F13\u5B58\u672A\u547D\u4E2D", explanation: "\u672A\u547D\u4E2D\u4E0A\u4E0B\u6587\u7F13\u5B58\u7684\u8F93\u5165 token\uFF0C\u6309\u6B64\u5355\u4EF7\u8BA1\u8D39\u3002" },
  { key: "output", label: "\u8F93\u51FA", explanation: "\u6A21\u578B\u751F\u6210\u7684\u8F93\u51FA token\uFF0C\u6309\u6B64\u5355\u4EF7\u8BA1\u8D39\u3002" }
];
var BUNDLED_PRICING = {
  source: PRICING_URL,
  checkedAt: Date.parse("2026-10-31T00:44:11+08:00"),
  currency: "CNY",
  unit: 1e6,
  models: [
    {
      id: "deepseek-flash",
      name: "Flash",
      version: "DeepSeek-V4.1-Flash-1017",
      idle: { inputHit: 0.02, inputMiss: 1, output: 4 },
      peak: { inputHit: 0.04, inputMiss: 2, output: 8 }
    },
    {
      id: "deepseek-v4-pro",
      name: "Pro",
      version: "DeepSeek-V4-Pro-0813",
      idle: { inputHit: 0.15, inputMiss: 4.5, output: 13.5 },
      peak: { inputHit: 0.3, inputMiss: 9, output: 27 }
    }
  ]
};
function isPricingData(value) {
  if (!value || typeof value !== "object") return false;
  const data = value;
  if (data.source !== PRICING_URL || data.currency !== "CNY" || data.unit !== 1e6 || !Number.isFinite(data.checkedAt) || data.checkedAt <= 0 || !Array.isArray(data.models) || !data.models.length || data.models.length > 16) return false;
  const ids = /* @__PURE__ */ new Set();
  return data.models.every((model) => {
    if (!model || typeof model.id !== "string" || !/^deepseek-[a-z0-9.-]+$/.test(model.id) || ids.has(model.id) || typeof model.name !== "string" || !model.name.length || model.name.length > 80 || typeof model.version !== "string" || model.version.length > 120) return false;
    ids.add(model.id);
    return ["idle", "peak"].every((period) => {
      const prices = model[period];
      return prices && PRICE_ROWS.every(({ key }) => typeof prices[key] === "number" && Number.isFinite(prices[key]) && prices[key] >= 0 && prices[key] < 1e6);
    });
  });
}

// src/pricing-route.ts
function createPricingRoute(source) {
  return {
    path: `/api/${PRICING_ENDPOINT}`,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return new Response("Expected JSON", { status: 415 });
      if (Number(request.headers.get("content-length")) > 4096) return new Response("Request too large", { status: 413 });
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (!body || typeof body !== "object" || !("type" in body) || body.type !== "client-request" || !("rpcId" in body) || typeof body.rpcId !== "string" || !body.rpcId.length || body.rpcId.length > 200 || !("method" in body) || body.method !== PRICING_ENDPOINT) return new Response("Invalid request", { status: 400 });
      const payload = "payload" in body ? body.payload : null;
      const force = typeof payload === "object" && payload !== null && "force" in payload && payload.force === true;
      try {
        const value = await source.load(force);
        return Response.json({ type: "server-response", rpcId: body.rpcId, result: { ok: true, value } });
      } catch {
        return Response.json({ type: "server-response", rpcId: body.rpcId, result: {
          ok: false,
          error: { code: "dsh-fg/pricing-unavailable", message: "\u5B98\u7F51\u4EF7\u683C\u6682\u65F6\u65E0\u6CD5\u540C\u6B65", details: {} }
        } });
      }
    }
  };
}

// src/pricing-source.ts
function text(html) {
  return html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "").replace(/<[^>]*>/g, " ").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code))).replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" })[entity]).replace(/\s+/g, " ").trim();
}
function tableGrid(table) {
  const grid = [];
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rows.length > 150) throw new Error("\u5B98\u7F51\u4EF7\u683C\u8868\u8FC7\u5927");
  rows.forEach((row, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of row[1].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      while (grid[r][c] !== void 0) c++;
      const span = (key) => {
        const match = new RegExp(`${key}\\s*=\\s*["']?(\\d+)`, "i").exec(cell[1]);
        const count = match ? Number(match[1]) : 1;
        if (count < 1 || count > 32) throw new Error("\u5B98\u7F51\u4EF7\u683C\u8868\u8DE8\u5EA6\u65E0\u6CD5\u8BC6\u522B");
        return count;
      };
      const height = span("rowspan"), width = span("colspan");
      const value = text(cell[2]);
      for (let y = r; y < r + height; y++) {
        grid[y] ??= [];
        for (let x = c; x < c + width; x++) grid[y][x] = value;
      }
      c += width;
    }
  });
  return grid;
}
function parseOfficialPricing(html, checkedAt = Date.now()) {
  if (html.length > 1e6) throw new Error("\u5B98\u7F51\u9875\u9762\u8FC7\u5927");
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  const grid = tables.map((table) => tableGrid(table[0])).find((rows) => rows.some((row) => row[0] === "\u6A21\u578B"));
  if (!grid) throw new Error("\u5B98\u7F51\u4EF7\u683C\u8868\u7ED3\u6784\u5DF2\u53D8\u5316");
  const header = grid.find((row) => row[0] === "\u6A21\u578B");
  const version = grid.find((row) => row[0] === "\u6A21\u578B\u7248\u672C");
  const modelColumns = header.flatMap((id, column) => /^deepseek-[a-z0-9.-]+$/.test(id) ? [{ id, column }] : []);
  if (!modelColumns.length) throw new Error("\u65E0\u6CD5\u8BC6\u522B\u5B98\u7F51\u6A21\u578B\u5217\u8868");
  const compact = (value) => value.replace(/\s/g, "");
  const data = {
    source: PRICING_URL,
    checkedAt,
    currency: "CNY",
    unit: 1e6,
    models: modelColumns.map(({ id, column }) => {
      const readPrices = (period) => Object.fromEntries(PRICE_ROWS.map(({ key }) => {
        const row = grid.find((row2) => {
          const labels = row2.slice(0, column).map(compact);
          return labels.some((label) => label.startsWith(period) && label.includes("\u65F6\u6BB5")) && labels.some((label) => key === "output" ? label.includes("\u767E\u4E07tokens\u8F93\u51FA") : label.includes("\u767E\u4E07tokens\u8F93\u5165") && label.includes(key === "inputHit" ? "\u7F13\u5B58\u547D\u4E2D" : "\u7F13\u5B58\u672A\u547D\u4E2D"));
        });
        const match = row && /^(\d+(?:\.\d+)?)\s*元$/.exec(row[column] ?? "");
        if (!match) throw new Error("\u5B98\u7F51\u5355\u4EF7\u6216\u8BA1\u4EF7\u5355\u4F4D\u5DF2\u53D8\u5316");
        return [key, Number(match[1])];
      }));
      return {
        id,
        name: /flash/i.test(id) ? "Flash" : /pro/i.test(id) ? "Pro" : id.replace(/^deepseek-/, ""),
        version: version?.[column] ?? id,
        idle: readPrices("\u7A7A\u95F2"),
        peak: readPrices("\u9AD8\u5CF0")
      };
    })
  };
  if (!isPricingData(data)) throw new Error("\u5B98\u7F51\u5B9A\u4EF7\u6570\u636E\u4E0D\u5B8C\u6574");
  return data;
}
function createPricingSource(options = {}) {
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let cached;
  let pending;
  let lastAttempt = -Infinity;
  let controller;
  let disposed = false;
  return {
    load(force = false) {
      if (disposed) return Promise.reject(new Error("\u63D2\u4EF6\u5DF2\u5173\u95ED"));
      if (pending) return pending;
      if (cached && now() - cached.checkedAt < (force ? 3e4 : PRICE_TTL)) return Promise.resolve(cached);
      if (now() - lastAttempt < 3e4) return Promise.reject(new Error("\u8BF7\u7A0D\u540E\u91CD\u8BD5\u5B98\u7F51\u540C\u6B65"));
      lastAttempt = now();
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12e3);
      const signal = controller.signal;
      pending = (async () => {
        const response = await request(PRICING_URL, { signal, headers: { accept: "text/html" }, credentials: "omit", redirect: "error" });
        if (!response.ok) throw new Error(`\u5B98\u7F51\u6682\u65F6\u65E0\u6CD5\u8BBF\u95EE\uFF08${response.status}\uFF09`);
        if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("\u5B98\u7F51\u672A\u8FD4\u56DE\u5B9A\u4EF7\u9875\u9762");
        if (Number(response.headers.get("content-length")) > 1e6) throw new Error("\u5B98\u7F51\u9875\u9762\u8FC7\u5927");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("\u5B98\u7F51\u9875\u9762\u4E3A\u7A7A");
        const decoder = new TextDecoder();
        let html = "", length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 1e6) throw new Error("\u5B98\u7F51\u9875\u9762\u8FC7\u5927");
            html += decoder.decode(value, { stream: true });
          }
          html += decoder.decode();
        } finally {
          await reader.cancel();
        }
        if (signal.aborted || disposed) throw new Error("\u5B98\u7F51\u540C\u6B65\u5DF2\u53D6\u6D88");
        cached = parseOfficialPricing(html, now());
        return cached;
      })().finally(() => {
        clearTimeout(timeout);
        pending = void 0;
      });
      return pending;
    },
    dispose() {
      disposed = true;
      controller?.abort();
    }
  };
}

// src/index.ts
var name = "dsh-fg";
var inject = ["connection"];
function apply(ctx) {
  const source = createPricingSource();
  const connection = ctx.get("connection");
  ctx.effect(() => () => source.dispose());
  ctx.effect(() => connection.fetch.register(createPricingRoute(source)));
}
export {
  apply,
  inject,
  name
};
