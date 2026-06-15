const http = require("node:http");
const { createDashboard } = require("./core/dashboard.cjs");
const { testModelConnection } = require("./core/model-tester.cjs");
const { createServices } = require("./core/services.cjs");
const { createStateStore } = require("./core/state-store.cjs");
const { error, ok } = require("./core/shared.cjs");

const DEFAULT_WEB_ORIGIN = "http://127.0.0.1:5173";
const DEFAULT_SERVER_PORT = 3767;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([DEFAULT_WEB_ORIGIN, process.env.FISHSWARM_ALLOWED_ORIGIN].filter(Boolean));
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function writeJson(req, res, body, status = body.ok === false ? 400 : 200) {
  setCorsHeaders(req, res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve(ok({}));
        return;
      }
      try {
        resolve(ok(JSON.parse(body)));
      } catch {
        resolve(error("VALIDATION_ERROR", "请求体必须是有效 JSON。"));
      }
    });
    req.on("error", () => resolve(error("BAD_REQUEST", "无法读取请求体。")));
  });
}

function startAppServer(options = {}) {
  const store = createStateStore(options);
  const state = store.load();
  const clients = new Set();
  const services = createServices(state, emit);

  function emit() {
    store.save(state);
    const payload = JSON.stringify(ok(createDashboard(state)));
    for (const client of clients) {
      client.write("event: dashboard\n");
      client.write(`data: ${payload}\n\n`);
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "OPTIONS") {
      setCorsHeaders(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      writeJson(req, res, ok({ service: "鱼群本地应用服务", stateFile: store.stateFile }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      writeJson(req, res, ok(createDashboard(state)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/factories") {
      writeJson(req, res, ok({ factories: state.factories }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/projects") {
      writeJson(req, res, ok({ projects: state.projects }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/agent-workers") {
      writeJson(req, res, ok({ agentWorkers: state.agentWorkers }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/talent-profiles") {
      writeJson(req, res, ok({ talentProfiles: state.talentProfiles }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/guarded-actions") {
      writeJson(req, res, ok({ guardedActions: state.guardedActions, actionReviewBriefs: state.actionReviewBriefs }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/capability-gaps") {
      writeJson(req, res, ok({ capabilityGaps: state.capabilityGaps, candidateTalentProfiles: state.candidateTalentProfiles, learningSources: state.learningSources }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      setCorsHeaders(req, res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      clients.add(res);
      res.write("event: dashboard\n");
      res.write(`data: ${JSON.stringify(ok(createDashboard(state)))}\n\n`);
      req.on("close", () => clients.delete(res));
      return;
    }

    const projectAction = url.pathname.match(/^\/api\/projects\/([^/]+)\/(build-team|generate-task-graph|generate-handoff)$/);
    if (req.method === "POST" && projectAction) {
      const [, projectId, action] = projectAction;
      if (action === "build-team") writeJson(req, res, services.buildProjectTeam(projectId));
      if (action === "generate-task-graph") writeJson(req, res, services.generateTaskGraph(projectId));
      if (action === "generate-handoff") writeJson(req, res, services.generateHandoff(projectId));
      return;
    }

    const taskAction = url.pathname.match(/^\/api\/tasks\/([^/]+)\/(run|review)$/);
    if (req.method === "POST" && taskAction) {
      const [, taskId, action] = taskAction;
      if (action === "run") writeJson(req, res, services.runTask(taskId));
      if (action === "review") writeJson(req, res, services.reviewTask(taskId));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJsonBody(req);
      writeJson(req, res, body.ok ? services.createProject(body.data) : body);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/factories") {
      const body = await readJsonBody(req);
      writeJson(req, res, body.ok ? services.createFactory(body.data) : body);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/agent-workers") {
      const body = await readJsonBody(req);
      writeJson(req, res, body.ok ? services.createAgentWorker(body.data) : body);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/model-connections/test") {
      const body = await readJsonBody(req);
      writeJson(req, res, body.ok ? await testModelConnection(body.data) : body);
      return;
    }

    const guardedAction = url.pathname.match(/^\/api\/guarded-actions\/([^/]+)\/(approve|reject)$/);
    if (req.method === "POST" && guardedAction) {
      const [, actionId, decision] = guardedAction;
      writeJson(req, res, services.decideGuardedAction(actionId, decision === "approve" ? "approved" : "rejected"));
      return;
    }

    writeJson(req, res, error("NOT_FOUND", "未找到接口。"), 404);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    const requestedPort = options.port ?? 0;
    server.listen(requestedPort, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        close: () => {
          for (const client of clients) {
            client.end();
          }
          server.close();
        }
      });
    });
  });
}

module.exports = { startAppServer };

if (require.main === module) {
  startAppServer({ port: Number(process.env.FISHSWARM_PORT || DEFAULT_SERVER_PORT) })
    .then((server) => {
      console.log(`鱼群本地应用服务已启动：${server.url}`);
    })
    .catch((reason) => {
      console.error(reason);
      process.exit(1);
    });
}
