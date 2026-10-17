const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("picker", {
  onSources: (cb) => {
    ipcRenderer.on("picker:sources", (_event, sources) => cb(sources));
  },
  select: (id) => ipcRenderer.send("picker:pick", id),
  cancel: () => ipcRenderer.send("picker:cancel"),
});
