'use strict';
/**
 * crash-logger.js — Logging persistente de errores fatales del proceso principal
 * y de los procesos renderer (uncaughtException, unhandledRejection,
 * render-process-gone, child-process-gone).
 *
 * Escribe líneas JSON en userData/logs/main.log, rotando el archivo cuando
 * supera MAX_LOG_SIZE_BYTES.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function getLogFile() {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'main.log');
}

function appendLog(entry) {
  try {
    const file = getLogFile();
    try {
      if (fs.statSync(file).size > MAX_LOG_SIZE_BYTES) {
        fs.renameSync(file, `${file}.old`);
      }
    } catch {}
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch {}
}

/** Registra los handlers globales de errores fatales del proceso principal. */
function registerCrashLogging() {
  process.on('uncaughtException', err => {
    appendLog({ type: 'uncaughtException', message: err?.message, stack: err?.stack });
    console.error('[uncaughtException]', err);
  });

  process.on('unhandledRejection', reason => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    appendLog({ type: 'unhandledRejection', message: err.message, stack: err.stack });
    console.error('[unhandledRejection]', err);
  });

  app.on('render-process-gone', (_event, webContents, details) => {
    appendLog({ type: 'render-process-gone', reason: details?.reason, exitCode: details?.exitCode, url: webContents?.getURL?.() });
    console.error('[render-process-gone]', details);
  });

  app.on('child-process-gone', (_event, details) => {
    appendLog({ type: 'child-process-gone', processType: details?.type, reason: details?.reason, exitCode: details?.exitCode });
    console.error('[child-process-gone]', details);
  });
}

module.exports = { registerCrashLogging, getLogFile };
