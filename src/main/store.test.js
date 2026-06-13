import { describe, it, expect } from 'vitest';
import store from './store.js';

const { normalizeApp, recordDailyUsage } = store;

describe('store — normalizeApp', () => {
  it('aplica los valores por defecto a una app vacía', () => {
    const app = normalizeApp({});
    expect(app.category).toBe('general');
    expect(app.iconType).toBe('initials');
    expect(app.openCount).toBe(0);
    expect(app.pinned).toBe(false);
    expect(app.favorite).toBe(false);
    expect(typeof app.installedAt).toBe('number');
  });

  it('preserva los valores existentes sin sobreescribirlos con los defaults', () => {
    const app = normalizeApp({
      name: 'Mi App',
      category: 'desarrollo',
      openCount: 7,
      pinned: true,
      installedAt: 12345,
    });
    expect(app.category).toBe('desarrollo');
    expect(app.openCount).toBe(7);
    expect(app.pinned).toBe(true);
    expect(app.installedAt).toBe(12345);
  });

  it('deriva iconValue de la inicial del nombre cuando no se especifica', () => {
    const app = normalizeApp({ name: 'whatsapp' });
    expect(app.iconValue).toBe('W');
  });

  it('coacciona openCount no numérico a 0', () => {
    expect(normalizeApp({ openCount: 'no-es-numero' }).openCount).toBe(0);
    expect(normalizeApp({ openCount: undefined }).openCount).toBe(0);
  });

  it('rellena sub-objetos (toolbar, shortcuts, security, automation, proxy, windowConfig) con sus defaults', () => {
    const app = normalizeApp({});
    expect(app.toolbar.buttons).toEqual(expect.arrayContaining(['back', 'forward', 'reload']));
    expect(app.shortcuts.reload).toBe('F5');
    expect(app.security.profile).toBe('personal');
    expect(app.automation.onOpen.enabled).toBe(false);
    expect(app.proxy.type).toBe('http');
    expect(app.windowConfig).toEqual({ width: 1280, height: 800 });
  });

  it('combina sub-objetos parciales con sus defaults sin perder los valores enviados', () => {
    const app = normalizeApp({
      toolbar: { enabled: true },
      shortcuts: { reload: 'Ctrl+Shift+R' },
      security: { sensitive: true },
      proxy: { enabled: true, host: '127.0.0.1' },
      windowConfig: { width: 1600 },
    });
    expect(app.toolbar.enabled).toBe(true);
    expect(app.toolbar.buttons.length).toBeGreaterThan(0);
    expect(app.shortcuts.reload).toBe('Ctrl+Shift+R');
    expect(app.shortcuts.back).toBe('Alt+ArrowLeft');
    expect(app.security.sensitive).toBe(true);
    expect(app.security.profile).toBe('personal');
    expect(app.proxy.enabled).toBe(true);
    expect(app.proxy.host).toBe('127.0.0.1');
    expect(app.windowConfig).toEqual({ width: 1600, height: 800 });
  });

  it('reemplaza toolbar.buttons vacío o inválido por los botones por defecto', () => {
    expect(normalizeApp({ toolbar: { buttons: [] } }).toolbar.buttons.length).toBeGreaterThan(0);
    expect(normalizeApp({ toolbar: { buttons: 'no-array' } }).toolbar.buttons.length).toBeGreaterThan(0);
  });

  it('normaliza security.profile a "personal" si el valor no es válido', () => {
    expect(normalizeApp({ security: { profile: 'invalido' } }).security.profile).toBe('personal');
    expect(normalizeApp({ security: { profile: 'work' } }).security.profile).toBe('work');
  });

  it('fuerza adblockCustomRules y adblockCosmeticRules a arrays', () => {
    expect(normalizeApp({ adblockCustomRules: 'no-array' }).adblockCustomRules).toEqual([]);
    expect(normalizeApp({ adblockCosmeticRules: null }).adblockCosmeticRules).toEqual([]);
    expect(normalizeApp({ adblockCustomRules: ['a.com'] }).adblockCustomRules).toEqual(['a.com']);
  });

  it('inicializa dailyUsage como objeto vacío y descarta valores inválidos', () => {
    expect(normalizeApp({}).dailyUsage).toEqual({});
    expect(normalizeApp({ dailyUsage: 'no-objeto' }).dailyUsage).toEqual({});
    expect(normalizeApp({ dailyUsage: ['a'] }).dailyUsage).toEqual({});
    const existing = { '2026-01-01': { opens: 2, timeMs: 1000 } };
    expect(normalizeApp({ dailyUsage: existing }).dailyUsage).toEqual(existing);
  });
});

describe('store — recordDailyUsage', () => {
  it('acumula aperturas y tiempo del día actual', () => {
    const app = normalizeApp({});
    recordDailyUsage(app, { opens: 1 });
    recordDailyUsage(app, { timeMs: 5000 });
    const today = new Date().toISOString().slice(0, 10);
    expect(app.dailyUsage[today]).toEqual({ opens: 1, timeMs: 5000 });
  });

  it('descarta entradas con más de 35 días de antigüedad', () => {
    const app = normalizeApp({});
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    app.dailyUsage = { [oldDate]: { opens: 3, timeMs: 9000 } };
    recordDailyUsage(app, { opens: 1 });
    expect(app.dailyUsage[oldDate]).toBeUndefined();
  });
});
