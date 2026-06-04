const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Escuchamos el evento de instalación desde React
ipcMain.on('install-app', (event, appData) => {
  const { id, name, url, iconUrl } = appData;

  // 1. Dónde vamos a guardar este acceso directo
  const desktopPath = app.getPath('desktop');
  const shortcutPath = path.join(desktopPath, `${name}.lnk`);

  // 2. ¿A dónde apunta este acceso directo?
  // Apunta a nuestro propio ejecutable (AppSpawner.exe)
  const exePath = app.getPath('exe');

  // 3. LA MAGIA: Los argumentos.
  // Le pasamos el ID o la URL como un "argumento oculto" al ejecutable.
  const args = `--launch-app=${id}`;

  // 4. Creamos el acceso directo en Windows usando Electron Shell
  const success = shell.writeShortcutLink(shortcutPath, {
    target: exePath,
    args: args,
    description: `Abrir ${name}`,
    icon: exePath, // Idealmente, descargarías el icono y lo referenciarías aquí
    iconIndex: 0
  });

  if (success) {
    console.log(`Acceso directo creado para ${name}`);
  }
});