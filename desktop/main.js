// sammekBTM masaüstü: canlı siteyi (https://sammekbtm.github.io/) kendi penceresinde açar,
// böylece her açılışta en güncel sürüm ve veriler gelir. İnternet yoksa dostça bir uyarı gösterir.
const { app, BrowserWindow, shell, Menu, net } = require("electron");
const path = require("path");
const URL_ = "https://sammekbtm.github.io/?source=desktop";
const HOST = "sammekbtm.github.io";
let win;
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
function offline() { win.loadFile(path.join(__dirname, "offline.html")); }
function load() { if (!net.isOnline()) return offline(); win.loadURL(URL_).catch(() => offline()); }
function create() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 380, minHeight: 600, backgroundColor: "#07090c", title: "sammekBTM",
    icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.webContents.setUserAgent(win.webContents.getUserAgent() + " SammekBTM-Desktop/" + app.getVersion());
  win.once("ready-to-show", () => win.show());
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => { if (isMain && code !== -3) offline(); });
  // dış bağlantılar (haberler vb.) varsayılan tarayıcıda açılsın
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    try { const u = new URL(url); if (u.protocol === "file:" || u.hostname === HOST) return; } catch (er) {}
    e.preventDefault(); shell.openExternal(url);
  });
  win.webContents.on("before-input-event", (e, i) => { if (i.type === "keyDown" && (i.key === "F5" || (i.control && i.key.toLowerCase() === "r"))) { e.preventDefault(); load(); } });
  // uygulama açık kaldıkça her gün en az bir kez tam yenile (yeni sürüm ve veriler için)
  setInterval(() => { if (net.isOnline() && win && !win.isDestroyed()) win.webContents.reloadIgnoringCache(); }, 6 * 3600e3);
  load();
}
app.whenReady().then(create);
app.on("window-all-closed", () => app.quit());
