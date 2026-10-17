const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  session,
  desktopCapturer,
  protocol,
  net,
} = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const OUT_ROOT = path.join(__dirname, "../out");
const APP_ICON = path.join(OUT_ROOT, "icon-512.png");

let mainWindow = null;
let pickerWindow = null;
let pendingDisplayRequest = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    icon: APP_ICON,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL("app://board/");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function closePicker() {
  if (pickerWindow && !pickerWindow.isDestroyed()) {
    pickerWindow.destroy();
  }
  pickerWindow = null;
}

function pickSource(sources) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener("picker:pick", onPick);
      ipcMain.removeListener("picker:cancel", onCancel);
      closePicker();
      resolve(value);
    };
    const onPick = (_event, id) => finish(id);
    const onCancel = () => finish(null);
    ipcMain.on("picker:pick", onPick);
    ipcMain.on("picker:cancel", onCancel);

    pickerWindow = new BrowserWindow({
      width: 900,
      height: 580,
      resizable: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      title: "Choose what to share",
      icon: APP_ICON,
      webPreferences: {
        preload: path.join(__dirname, "picker-preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const payload = sources.map((source) => ({
      id: source.id,
      name: source.name,
      isScreen: source.id.startsWith("screen"),
      thumbnail: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
    }));

    pickerWindow.loadFile(path.join(__dirname, "picker.html"));
    pickerWindow.webContents.once("did-finish-load", () => {
      if (!pickerWindow || pickerWindow.isDestroyed()) return;
      pickerWindow.webContents.send("picker:sources", payload);
      pickerWindow.show();
    });
    pickerWindow.on("closed", () => {
      pickerWindow = null;
      finish(null);
    });
  });
}

function registerDisplayMediaHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (pendingDisplayRequest) {
        callback();
        return;
      }
      pendingDisplayRequest = request;
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 360, height: 220 },
          fetchWindowIcons: false,
        });
        const id = await pickSource(sources);
        const source = sources.find((s) => s.id === id);
        if (!source) {
          callback();
          return;
        }
        callback({
          video: source,
          audio: request.audioRequested ? "loopback" : undefined,
        });
      } catch {
        callback();
      } finally {
        pendingDisplayRequest = null;
      }
    }
  );
}

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    let target = decodeURIComponent(pathname);
    if (target === "/" || target === "") target = "/index.html";
    const filePath = path.normalize(path.join(OUT_ROOT, target));
    if (!filePath.startsWith(OUT_ROOT + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

app.whenReady().then(() => {
  registerAppProtocol();

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(
        permission === "media" ||
          permission === "display-capture" ||
          permission === "fullscreen"
      );
    }
  );
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) =>
      permission === "media" ||
      permission === "display-capture" ||
      permission === "fullscreen"
  );

  registerDisplayMediaHandler();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
