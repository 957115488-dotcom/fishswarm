const { contextBridge } = require("electron");

const apiArg = process.argv.find((arg) => arg.startsWith("--fishswarm-api="));
const apiBaseUrl = apiArg ? apiArg.slice("--fishswarm-api=".length) : "http://127.0.0.1:3767";

contextBridge.exposeInMainWorld("fishswarm", {
  getApiBaseUrl: () => apiBaseUrl,
  getPlatform: () => process.platform
});
