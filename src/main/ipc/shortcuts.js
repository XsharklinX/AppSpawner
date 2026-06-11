'use strict';
/**
 * shortcuts.js — Creación/eliminación de accesos directos en el SO.
 * Windows  → .lnk via shell.writeShortcutLink
 * macOS    → Script .command + bundle .app  (AppleScript wrapper)
 * Linux    → Archivos .desktop (freedesktop.org spec)
 */
const fs   = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const { ensureAppIcon } = require('../icon-utils');

/**
 * Registra los handlers IPC de shortcuts.
 * @param {Electron.IpcMain} ipcMain
 * @param {object} store - módulo store (read/write)
 */
function registerShortcutHandlers(ipcMain, store) {

  ipcMain.handle('shortcuts:create', async (_event, appId) => {
    const data      = store.read();
    const appConfig = data.apps.find(a => a.id === appId);
    if (!appConfig) return { success: false, error: 'App no encontrada' };

    const settings = data.settings;
    const results  = {};

    if (settings.desktopShortcuts) {
      results.desktop = await _createShortcut(appConfig, 'desktop');
    }
    if (settings.startMenuShortcuts) {
      results.startMenu = await _createShortcut(appConfig, 'startMenu');
    }

    return { success: true, results };
  });

  ipcMain.handle('shortcuts:remove', async (_event, appId) => {
    const data      = store.read();
    const appConfig = data.apps.find(a => a.id === appId);
    if (!appConfig) return { success: false };

    await _removeShortcuts(appConfig);
    return { success: true };
  });

  ipcMain.handle('shortcuts:repair-all', async () => {
    const data = store.read();
    const results = [];
    for (const appConfig of data.apps || []) {
      const appResult = { appId: appConfig.id, name: appConfig.name, results: {} };
      if (data.settings.desktopShortcuts) {
        appResult.results.desktop = await _createShortcut(appConfig, 'desktop');
      }
      if (data.settings.startMenuShortcuts) {
        appResult.results.startMenu = await _createShortcut(appConfig, 'startMenu');
      }
      results.push(appResult);
    }
    const failed = results.flatMap(item => Object.values(item.results)).filter(result => result?.success === false);
    return { success: failed.length === 0, repaired: results.length, results };
  });
}

// ── Dispatcher por plataforma ─────────────────────────────────────────────────

async function _createShortcut(appConfig, type) {
  switch (process.platform) {
    case 'win32':  return _win32Create(appConfig, type);
    case 'darwin': return _macCreate(appConfig, type);
    default:       return _linuxCreate(appConfig, type);
  }
}

async function _removeShortcuts(appConfig) {
  switch (process.platform) {
    case 'win32':  return _win32Remove(appConfig);
    case 'darwin': return _macRemove(appConfig);
    default:       return _linuxRemove(appConfig);
  }
}

// ── Windows ───────────────────────────────────────────────────────────────────

async function _win32Create(appConfig, type) {
  try {
    const targetDir = type === 'desktop'
      ? app.getPath('desktop')
      : path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');

    fs.mkdirSync(targetDir, { recursive: true });

    const shortcutPath = path.join(targetDir, `${appConfig.name}.lnk`);
    const IS_DEV = !app.isPackaged;
    const iconPaths = await ensureAppIcon(appConfig);
    const existed = fs.existsSync(shortcutPath);
    if (existed) {
      // Recreate the .lnk instead of replacing in-place. Windows is aggressive
      // about shortcut icon caching, and a fresh link is more reliable when an
      // app changes from the generic icon to its own generated icon.
      try { fs.unlinkSync(shortcutPath); } catch {}
    }
    const operation = 'create';

    let target, args;
    if (IS_DEV) {
      // En dev, electron.exe es una app de consola: al lanzarse desde un .lnk
      // Windows abre una ventana CMD visible. Se usa wscript.exe + VBS con windowStyle=0
      // para lanzar electron sin mostrar ninguna ventana de consola.
      const launcherDir = path.join(app.getPath('userData'), 'launchers');
      fs.mkdirSync(launcherDir, { recursive: true });
      const vbsPath  = path.join(launcherDir, `${appConfig.id}.vbs`);
      const exePath  = process.execPath.replace(/"/g, '""');
      const projPath = app.getAppPath().replace(/"/g, '""');
      const vbsContent = `CreateObject("WScript.Shell").Run """${exePath}"" ""${projPath}"" --launch-app=${appConfig.id}", 0, False\r\n`;
      fs.writeFileSync(vbsPath, vbsContent, 'utf8');
      target = 'wscript.exe';
      args   = `"${vbsPath}"`;
    } else {
      target = process.execPath;
      args   = `--launch-app=${appConfig.id}`;
    }

    const success = shell.writeShortcutLink(shortcutPath, operation, {
      target,
      args,
      description:      `Abrir ${appConfig.name} en AppSpawner`,
      icon:             iconPaths.ico,
      iconIndex:        0,
      workingDirectory: path.dirname(process.execPath),
      appUserModelId:   `com.appspawner.app.${appConfig.id}`,
    });

    return { success, path: shortcutPath, icon: iconPaths.ico, operation, recreated: existed };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _win32Remove(appConfig) {
  const targets = [
    path.join(app.getPath('desktop'), `${appConfig.name}.lnk`),
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appConfig.name}.lnk`),
    path.join(app.getPath('userData'), 'launchers', `${appConfig.id}.vbs`),
  ];
  targets.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} });
}

// ── macOS ─────────────────────────────────────────────────────────────────────

async function _macCreate(appConfig, type) {
  try {
    const targetDir = type === 'desktop'
      ? app.getPath('desktop')
      : path.join(app.getPath('home'), 'Applications');

    const bundlePath  = path.join(targetDir, `${appConfig.name}.app`);
    const macOSPath   = path.join(bundlePath, 'Contents', 'MacOS');
    const resPath     = path.join(bundlePath, 'Contents', 'Resources');

    fs.mkdirSync(macOSPath, { recursive: true });
    fs.mkdirSync(resPath,   { recursive: true });

    // Script ejecutable
    const scriptPath = path.join(macOSPath, appConfig.name);
    const IS_DEV = !app.isPackaged;
    const execCmd = IS_DEV
      ? `"${process.execPath}" "${app.getAppPath()}" --launch-app=${appConfig.id}`
      : `"${process.execPath}" --launch-app=${appConfig.id}`;
    fs.writeFileSync(scriptPath, `#!/bin/bash\nexec ${execCmd} "$@"\n`);
    fs.chmodSync(scriptPath, '755');

    const iconPaths = await ensureAppIcon(appConfig);
    fs.copyFileSync(iconPaths.png, path.join(resPath, 'icon.png'));

    // Info.plist mínimo
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appConfig.name}</string>
  <key>CFBundleDisplayName</key><string>${appConfig.name}</string>
  <key>CFBundleIdentifier</key><string>com.appspawner.app.${appConfig.id}</string>
  <key>CFBundleExecutable</key><string>${appConfig.name}</string>
  <key>CFBundleIconFile</key><string>icon.png</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><false/>
</dict>
</plist>`;
    fs.writeFileSync(path.join(bundlePath, 'Contents', 'Info.plist'), plist);

    return { success: true, path: bundlePath, icon: iconPaths.png };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _macRemove(appConfig) {
  const targets = [
    path.join(app.getPath('desktop'), `${appConfig.name}.app`),
    path.join(app.getPath('home'), 'Applications', `${appConfig.name}.app`),
  ];
  targets.forEach(p => { try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); } catch {} });
}

// ── Linux ─────────────────────────────────────────────────────────────────────

async function _linuxCreate(appConfig, type) {
  try {
    const targetDir = type === 'desktop'
      ? app.getPath('desktop')
      : path.join(app.getPath('home'), '.local', 'share', 'applications');

    fs.mkdirSync(targetDir, { recursive: true });

    const fileName    = `appspawner-${appConfig.id}.desktop`;
    const desktopPath = path.join(targetDir, fileName);

    const iconPaths = await ensureAppIcon(appConfig);
    const entry = [
      '[Desktop Entry]',
      `Name=${appConfig.name}`,
      `Comment=Abrir ${appConfig.name} en AppSpawner`,
      `Exec="${process.execPath}" ${!app.isPackaged ? `"${app.getAppPath()}" ` : ''}--launch-app=${appConfig.id} %u`,
      `Icon=${iconPaths.png}`,
      `Terminal=false`,
      `Type=Application`,
      `Categories=Network;WebBrowser;`,
      `StartupWMClass=AppSpawner`,
    ].join('\n');

    fs.writeFileSync(desktopPath, entry + '\n');
    fs.chmodSync(desktopPath, '755');

    return { success: true, path: desktopPath, icon: iconPaths.png };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _linuxRemove(appConfig) {
  const targets = [
    path.join(app.getPath('desktop'),        `appspawner-${appConfig.id}.desktop`),
    path.join(app.getPath('home'), '.local', 'share', 'applications', `appspawner-${appConfig.id}.desktop`),
  ];
  targets.forEach(p => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {} });
}

module.exports = { registerShortcutHandlers };
