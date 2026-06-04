/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId:       'com.appspawner.desktop',
  productName: 'AppSpawner',
  copyright:   `Copyright © ${new Date().getFullYear()} AppSpawner`,

  directories: {
    output:         'release',
    buildResources: 'assets',
  },

  files: [
    'dist/renderer/**/*',
    'src/main/**/*',
    'node_modules/uuid/**/*',
    'assets/icon.png',
    'package.json',
  ],

  // Asegurar que uuid se incluye como dependencia nativa
  extraResources: [
    { from: 'assets', to: 'assets', filter: ['**/*'] },
  ],

  // Asegurarse de que las dependencias de producción se incluyen
  npmRebuild: false,
  nodeGypRebuild: false,

  // Windows: NSIS installer
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/icon.ico',   // ruta relativa al raíz del proyecto
    requestedExecutionLevel: 'asInvoker',
    protocols: [{ name: 'AppSpawner', schemes: ['appspawner'] }],
  },
  nsis: {
    oneClick:                        false,
    allowElevation:                  true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut:           true,
    createStartMenuShortcut:         true,
    shortcutName:                    'AppSpawner',
    installerIcon:                   'assets/icon.ico',
    uninstallerIcon:                 'assets/icon.ico',
  },

  // macOS: DMG + ZIP
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    icon:             'assets/icon.icns',
    category:         'public.app-category.utilities',
    protocols:        [{ name: 'AppSpawner', schemes: ['appspawner'] }],
    hardenedRuntime:  true,
    gatekeeperAssess: false,
  },

  // Linux: AppImage + deb
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb',      arch: ['x64'] },
    ],
    icon:      'assets/icon.png',
    category:  'Utility',
    protocols: [{ name: 'AppSpawner', schemes: ['appspawner'] }],
    desktop: {
      Name:       'AppSpawner',
      Comment:    'Site-Specific Browser Manager',
      Categories: 'Utility;Network;WebBrowser;',
    },
  },

  publish: null,
};
