import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const designSystem = css.slice(css.indexOf('CAPBOY DESIGN-SYSTEM'));

describe('CAPBOY Design-System', () => {
  it('legt die gemeinsame Kartenachse zentral fest', () => {
    expect(designSystem).toContain('--cap-page-inline:28px');
    expect(designSystem).toContain('--cap-reference-inline:18.5px');
    expect(designSystem).toContain('@media(max-width:430px)');
    expect(designSystem).toContain('--cap-reference-inline:16px');
    expect(designSystem).toContain('--cap-content-max:604px');
    expect(designSystem).toContain('width:min(calc(100% - 56px),var(--cap-content-max))');
  });

  it('wendet die Achse auf breite Seiten und Rasterseiten an', () => {
    expect(designSystem).toContain(':root[data-seite="sleep"] .sleep-dex-page [data-sleep-content]');
    expect(designSystem).toContain(':root[data-seite="habits"] .routine-dex-page :is(.routine-hero-stack,.routine-plan,.routine-notizen)');
    expect(designSystem).toContain(':root[data-seite="shopping"] .shopping-dex-wrap .einkauf-suche');
    expect(designSystem).toContain('.neo-dex-page .sammlung-seite');
    expect(designSystem).toContain(':root[data-seite="profile"] .profil-scrollinhalt');
    expect(designSystem).toContain('100vw - var(--cap-reference-inline) - var(--cap-reference-inline)');
  });

  it('haelt Header, Dock und Sheets global statt seitenspezifisch', () => {
    expect(designSystem).toContain('.app-dex-header-actions{gap:4px}');
    expect(designSystem).toContain('.app-dex-dock-inner{');
    expect(designSystem).toContain('.kategorie-sheet{');
    expect(designSystem).toContain('--cap-sheet-inline:28px');
    expect(designSystem).toContain('--cap-sheet-max:520px');
    expect(designSystem).toContain('.kategorie-sheet>header + :is(.sheet-menue,.kategorie-sheet-menu,.mahl-add-gruppe)');
    expect(designSystem).toContain('.kategorie-sheet :is(.sheet-menue,.kategorie-sheet-menu)>button');
  });

  it('vereinheitlicht Tapeten und Beitragsdetails', () => {
    expect(designSystem).toContain('mask-size:500px auto!important');
    expect(designSystem).toContain('.dex-detail-card-actions');
    expect(designSystem).toContain('border-radius:var(--cap-card-radius)!important');
  });
});
