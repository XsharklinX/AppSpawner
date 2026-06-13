import { describe, it, expect, beforeAll } from 'vitest';
import adblock from './adblock.js';

const {
  loadBlockList,
  isBlocked,
  isBlockedDomain,
  isSafeCssSelector,
  parseAbpList,
  compileNetworkRule,
  parseRuleOptions,
  matchesAbpRule,
  matchesAnyAbpRule,
  isThirdParty,
  normalizeUrlToken,
} = adblock;

describe('adblock engine — domain blocklist', () => {
  beforeAll(() => {
    loadBlockList();
  });

  it('bloquea dominios conocidos del blocklist', () => {
    expect(isBlocked('https://doubleclick.net/ads.js')).toMatch(/^Dominio:/);
    expect(isBlocked('https://www.googletagmanager.com/gtm.js')).toMatch(/^Dominio:/);
  });

  it('bloquea subdominios de un dominio bloqueado', () => {
    expect(isBlocked('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).toMatch(/^Dominio:/);
  });

  it('permite URLs de dominios no bloqueados', () => {
    expect(isBlocked('https://example.com/index.html')).toBeNull();
  });

  it('isBlockedDomain refleja el mismo blocklist para navegaciones', () => {
    expect(isBlockedDomain('https://doubleclick.net/x')).toBe(true);
    expect(isBlockedDomain('https://example.com/x')).toBe(false);
  });
});

describe('adblock engine — reglas custom y modo agresivo', () => {
  beforeAll(() => {
    loadBlockList();
  });

  it('bloquea por regla custom cuando el hostname o la URL coincide', () => {
    expect(isBlocked('https://tracker.example.com/pixel.gif', ['tracker.example.com'])).toMatch(/^Regla:/);
    expect(isBlocked('https://example.com/foo', [])).toBeNull();
  });

  it('ignora reglas custom vacías o con sintaxis de cosmético (##)', () => {
    expect(isBlocked('https://example.com/foo', ['', '  ', 'example.com##.ad'])).toBeNull();
  });

  it('modo agresivo bloquea patrones de tracking de terceros en tipos bloqueables', () => {
    const result = isBlocked('https://cdn.example.com/analytics/tracker.js', [], {
      aggressive: true,
      resourceType: 'script',
      referrer: 'https://mysite.com',
    });
    expect(result).toBe('Modo agresivo');
  });

  it('modo agresivo no bloquea recursos de primera parte', () => {
    const result = isBlocked('https://mysite.com/analytics/tracker.js', [], {
      aggressive: true,
      resourceType: 'script',
      referrer: 'https://mysite.com',
    });
    expect(result).toBeNull();
  });

  it('respeta el whitelist de reproductores incluso en modo agresivo', () => {
    const result = isBlocked('https://player.vimeo.com/video/123/tracking', [], {
      aggressive: true,
      resourceType: 'script',
      referrer: 'https://mysite.com',
    });
    expect(result).toBeNull();
  });
});

describe('adblock engine — parser de listas ABP', () => {
  it('parsea reglas de dominio (||domain^) como kind: domain', () => {
    const { networkRules } = parseAbpList('||ads.example.com^', { id: 'test' });
    expect(networkRules).toHaveLength(1);
    expect(networkRules[0]).toMatchObject({ kind: 'domain', domain: 'ads.example.com', source: 'test' });
  });

  it('parsea reglas de excepción (@@) por separado', () => {
    const { networkRules, exceptionRules } = parseAbpList('||ads.example.com^\n@@||good.example.com^', { id: 'test' });
    expect(networkRules).toHaveLength(1);
    expect(exceptionRules).toHaveLength(1);
    expect(exceptionRules[0].domain).toBe('good.example.com');
  });

  it('ignora comentarios y líneas vacías', () => {
    const { networkRules } = parseAbpList('! comentario\n\n[Adblock Plus 2.0]\n||ads.example.com^', { id: 'test' });
    expect(networkRules).toHaveLength(1);
  });

  it('extrae reglas cosméticas (##selector) en globalCosmetic o domainCosmetic', () => {
    const { globalCosmetic, domainCosmetic } = parseAbpList('##.ad-banner\nexample.com##.sponsored', { id: 'test' });
    expect(globalCosmetic).toContain('.ad-banner');
    expect(domainCosmetic.get('example.com')).toContain('.sponsored');
  });

  it('descarta reglas con opciones no soportadas (document/elemhide)', () => {
    const { networkRules } = parseAbpList('||ads.example.com^$document', { id: 'test' });
    expect(networkRules).toHaveLength(0);
  });
});

describe('adblock engine — compileNetworkRule / parseRuleOptions', () => {
  it('compila una regla de dominio con path token', () => {
    const rule = compileNetworkRule('||ads.example.com/banner^', { id: 'test' });
    expect(rule).toMatchObject({ kind: 'domain', domain: 'ads.example.com' });
    expect(rule.pathToken).toContain('/banner');
  });

  it('compila una regla de URL genérica cuando no empieza con ||', () => {
    const rule = compileNetworkRule('trackingpixel', { id: 'test' });
    expect(rule).toMatchObject({ kind: 'url', token: 'trackingpixel' });
  });

  it('descarta tokens demasiado cortos', () => {
    expect(compileNetworkRule('ab', { id: 'test' })).toBeNull();
  });

  it('descarta el wildcard global "*"', () => {
    expect(compileNetworkRule('*', { id: 'test' })).toBeNull();
  });

  it('parsea opciones de tipo y third-party', () => {
    const options = parseRuleOptions('script,third-party,domain=example.com|~excluded.com');
    expect(options.types.has('script')).toBe(true);
    expect(options.thirdParty).toBe(true);
    expect(options.domains).toEqual(['example.com', '~excluded.com']);
  });

  it('marca unsupported para document/elemhide', () => {
    expect(parseRuleOptions('document').unsupported).toBe(true);
    expect(parseRuleOptions('elemhide').unsupported).toBe(true);
  });
});

describe('adblock engine — matchesAbpRule / matchesAnyAbpRule', () => {
  it('una regla de dominio coincide con el dominio exacto y subdominios', () => {
    const rule = compileNetworkRule('||ads.example.com^', { id: 'test' });
    expect(matchesAbpRule('https://ads.example.com/x', rule)).toBe(true);
    expect(matchesAbpRule('https://sub.ads.example.com/x', rule)).toBe(true);
    expect(matchesAbpRule('https://notads.example.com/x', rule)).toBe(false);
  });

  it('una regla de dominio con pathToken solo coincide si la URL incluye ese path', () => {
    const rule = compileNetworkRule('||ads.example.com/banner^', { id: 'test' });
    expect(matchesAbpRule('https://ads.example.com/banner/img.png', rule)).toBe(true);
    expect(matchesAbpRule('https://ads.example.com/other/img.png', rule)).toBe(false);
  });

  it('matchesAnyAbpRule devuelve true si alguna regla coincide', () => {
    const rules = [
      compileNetworkRule('||a.example.com^', { id: 'test' }),
      compileNetworkRule('||ads.example.com^', { id: 'test' }),
    ];
    expect(matchesAnyAbpRule('https://ads.example.com/x', rules)).toBe(true);
    expect(matchesAnyAbpRule('https://other.example.com/x', rules)).toBe(false);
  });

  it('respeta la opción third-party al evaluar coincidencias', () => {
    const rule = compileNetworkRule('||ads.example.com^$third-party', { id: 'test' });
    expect(matchesAbpRule('https://ads.example.com/x', rule, { referrer: 'https://mysite.com' })).toBe(true);
    expect(matchesAbpRule('https://ads.example.com/x', rule, { referrer: 'https://ads.example.com' })).toBe(false);
  });
});

describe('adblock engine — isThirdParty / normalizeUrlToken', () => {
  it('detecta que un mismo dominio raíz no es third-party', () => {
    expect(isThirdParty('https://sub.example.com/x', 'https://example.com')).toBe(false);
    expect(isThirdParty('https://ads.example.com/x', 'https://mysite.com')).toBe(true);
  });

  it('sin referrer se considera third-party', () => {
    expect(isThirdParty('https://example.com/x', '')).toBe(true);
  });

  it('normalizeUrlToken limpia anclas y wildcards', () => {
    expect(normalizeUrlToken('|*ads/banner*^')).toBe('ads/banner/');
  });
});

describe('adblock engine — isSafeCssSelector', () => {
  it('acepta selectores CSS simples', () => {
    expect(isSafeCssSelector('.ad-banner')).toBe(true);
    expect(isSafeCssSelector('#sponsored-content')).toBe(true);
  });

  it('rechaza selectores vacíos o demasiado largos', () => {
    expect(isSafeCssSelector('')).toBe(false);
    expect(isSafeCssSelector('.x'.repeat(400))).toBe(false);
  });

  it('rechaza selectores con caracteres de inyección CSS o pseudo-clases peligrosas', () => {
    expect(isSafeCssSelector('.ad { background: url(javascript:alert(1)) }')).toBe(false);
    expect(isSafeCssSelector(':contains("ads")')).toBe(false);
    expect(isSafeCssSelector(':-abp-properties(...)')).toBe(false);
  });
});
