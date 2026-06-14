const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
const { startAppServer } = require("./app-server.cjs");

let mainWindow;
let appServer;

async function createWindow() {
  appServer = await startAppServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1060,
    minHeight: 700,
    title: "鱼群",
    backgroundColor: "#f5f3ee",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--fishswarm-api=${appServer.url}`]
    }
  });

  Menu.setApplicationMenu(null);

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on("before-quit", () => {
  if (appServer) {
    appServer.close();
  }
});
