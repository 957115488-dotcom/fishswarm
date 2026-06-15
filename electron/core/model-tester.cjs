const { error, ok } = require("./shared.cjs");

const OPENAI_COMPATIBLE_FORMATS = new Set(["openai_chat", "ollama_openai"]);

async function testModelConnection(input) {
  const validation = validateInput(input);
  if (!validation.ok) return validation;

  const providerKind = input.providerKind || "openai_compatible";
  const apiFormat = input.apiFormat || defaultApiFormat(providerKind);
  const baseUrl = normalizeBaseUrl(trimTrailingSlash(input.baseUrl), providerKind, apiFormat);
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const startedAt = Date.now();

  try {
    const response = await requestProvider({ providerKind, apiFormat, baseUrl, apiKey });
    const latencyMs = Date.now() - startedAt;
    const body = await readSmallBody(response);

    if (response.ok) {
      return ok({
        status: "connected",
        latencyMs,
        checkedAt: new Date().toISOString(),
        message: "连接成功，模型服务可访问。",
        providerStatus: response.status
      });
    }

    return error("MODEL_CONNECTION_FAILED", statusMessage(response.status), {
      status: response.status,
      latencyMs,
      body: summarizeBody(body)
    });
  } catch (reason) {
    return error("MODEL_CONNECTION_FAILED", reason instanceof Error ? reason.message : "连接检测失败。");
  }
}

function validateInput(input) {
  if (!input || typeof input !== "object") return error("VALIDATION_ERROR", "请求体必须是 JSON 对象。");
  if (typeof input.baseUrl !== "string" || !input.baseUrl.trim()) return error("VALIDATION_ERROR", "Base URL 不能为空。");
  if (typeof input.providerKind !== "string" || !input.providerKind.trim()) return error("VALIDATION_ERROR", "Provider 类型不能为空。");
  if (input.apiFormat && typeof input.apiFormat !== "string") return error("VALIDATION_ERROR", "API 格式无效。");
  if (input.providerKind !== "ollama" && (typeof input.apiKey !== "string" || !input.apiKey.trim())) {
    return error("VALIDATION_ERROR", "API Key 不能为空。");
  }
  try {
    new URL(input.baseUrl);
  } catch {
    return error("VALIDATION_ERROR", "Base URL 不是有效 URL。");
  }
  return ok({});
}

function requestProvider({ providerKind, apiFormat, baseUrl, apiKey }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const headers = createHeaders(apiFormat, apiKey);
  const url = createTestUrl(providerKind, apiFormat, baseUrl, apiKey);

  return fetch(url, {
    method: "GET",
    headers,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
}

function createTestUrl(providerKind, apiFormat, baseUrl, apiKey) {
  if (providerKind === "deepseek") return `${removeTrailingPath(baseUrl, "/v1")}/models`;
  if (providerKind === "openrouter") return `${baseUrl}/auth/key`;
  if (apiFormat === "gemini_generate_content") {
    const url = new URL(`${baseUrl}/models`);
    url.searchParams.set("key", apiKey);
    return url.toString();
  }
  if (apiFormat === "anthropic_messages") return `${baseUrl}/models`;
  if (OPENAI_COMPATIBLE_FORMATS.has(apiFormat)) return `${baseUrl}/models`;
  return `${baseUrl}/models`;
}

function normalizeBaseUrl(baseUrl, providerKind, apiFormat) {
  if (providerKind === "minimax" && apiFormat === "anthropic_messages" && baseUrl.endsWith("/anthropic")) {
    return `${baseUrl}/v1`;
  }
  if (providerKind === "gemini" && apiFormat === "openai_chat" && !baseUrl.endsWith("/openai")) {
    return `${baseUrl}/openai`;
  }
  return baseUrl;
}

function removeTrailingPath(baseUrl, suffix) {
  return baseUrl.endsWith(suffix) ? baseUrl.slice(0, -suffix.length) : baseUrl;
}

function createHeaders(apiFormat, apiKey) {
  const headers = {
    Accept: "application/json"
  };
  if (apiFormat === "anthropic_messages") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    return headers;
  }
  if (apiFormat !== "gemini_generate_content" && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function defaultApiFormat(providerKind) {
  if (providerKind === "anthropic") return "anthropic_messages";
  if (providerKind === "gemini") return "gemini_generate_content";
  if (providerKind === "ollama") return "ollama_openai";
  if (providerKind === "custom") return "custom_http";
  return "openai_chat";
}

async function readSmallBody(response) {
  const text = await response.text();
  return text.slice(0, 600);
}

function summarizeBody(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

function statusMessage(status) {
  if (status === 401 || status === 403) return "认证失败，请检查 API Key 或权限。";
  if (status === 404) return "检测地址不存在，请检查 Base URL 或供应商类型。";
  if (status === 429) return "供应商限流，请稍后再试。";
  if (status >= 500) return "模型供应商服务异常。";
  return `连接失败，供应商返回 HTTP ${status}。`;
}

function trimTrailingSlash(value) {
  return value.trim().replace(/\/+$/, "");
}

module.exports = {
  testModelConnection
};
