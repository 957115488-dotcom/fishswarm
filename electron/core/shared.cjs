function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function ok(data) {
  return { ok: true, data };
}

function error(code, message, details = {}) {
  return { ok: false, error: { code, message, details } };
}

function notFound(name) {
  const label = { Project: "项目", Task: "任务" }[name] || name;
  return error("NOT_FOUND", `未找到${label}。`);
}

function createEvent(actor, event, detail) {
  return {
    id: id("event"),
    actor,
    event,
    detail,
    time: now()
  };
}

module.exports = {
  createEvent,
  error,
  id,
  notFound,
  now,
  ok
};
