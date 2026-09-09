import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const designSystem = css.slice(css.indexOf('CAPBOY DESIGN-SYSTEM'));
const categoryIcons = readFileSync(new URL('./categoryIcons.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const entryDetail = readFileSync(new URL('./dexEntryDetail.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');

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
    expect(designSystem).toContain(':root[data-seite="food-log"] .neo-dex-page.dex-fixkopf>.wrap');
    expect(designSystem).toContain(':root[data-seite="supps"] .neo-dex-page.dex-fixkopf>.wrap');
    expect(designSystem).toContain(':root[data-seite="stress"] .neo-dex-page .kategorie-scrollinhalt');
    expect(designSystem).toContain('.neo-dex-page .sammlung-seite');
    expect(designSystem).toContain('.neo-dex-page :is(.dex-eintrag-listen,.dex-mehr-laden)');
    expect(designSystem).toContain('.neo-dex-page .unter-sammlungen-block>h2');
    expect(designSystem).toContain('padding-left:var(--cap-reference-inline)!important');
    expect(designSystem).toContain('width:100vw!important');
    expect(designSystem).toContain('margin-left:calc(50% - 50vw)!important');
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
    expect(designSystem).toContain(':root[data-seite="coins"] .coin-dex-page::before');
    expect(designSystem).toContain('.dex-detail-card-actions');
    expect(designSystem).toContain('background:transparent!important');
    expect(designSystem).toContain('border-radius:var(--cap-card-radius)!important');
  });

  it('beschraenkt das Longpress-Menue von Unterordnern auf Verwaltung', () => {
    const start = main.indexOf('function unterordnerEinstellungenOeffner');
    const end = main.indexOf('async function dexSammlungsStatistik', start);
    const folderMenu = main.slice(start, end);
    expect(folderMenu).toContain('onRename:');
    expect(folderMenu).toContain('onDelete:');
    expect(folderMenu).not.toContain('onInfo:');
    expect(main).toContain("bindLongPress(view.querySelector('.unter-sammlungen-grid')");
    expect(main).toContain("bindLongPress(container.querySelector('.unter-sammlungen-grid')");
    expect(categoryIcons).toContain("actions.title || 'Seite bearbeiten'");
  });

  it('verwendet ROUTINEN-Lila und eine weisse Silhouette im Splash', () => {
    const splashStart = css.indexOf('.app-start-splash{');
    const splashEnd = css.indexOf('.app-logo-font-ready', splashStart);
    const splashCss = css.slice(splashStart, splashEnd);
    expect(indexHtml).toContain('name="theme-color" content="#4B0082"');
    expect(indexHtml).toContain('background:#4B0082!important');
    expect(manifest).toContain('"background_color": "#4B0082"');
    expect(splashCss).toContain('background:#4B0082');
    expect(splashCss).toContain('.app-start-splash .brand{');
    expect(splashCss).toContain('--sil-filter:brightness(0) invert(1)');
  });

  it('zentriert Detailaktionen auch ohne seitenspezifische Hilfsklasse', () => {
    const actionStart = designSystem.indexOf('.dex-detail-popup>.dex-detail-card-actions :is(.neo-dex-action-button');
    const actionEnd = designSystem.indexOf('.dex-detail-popup>.dex-detail-card-actions :is(.neo-dex-action-popover', actionStart);
    const actionCss = designSystem.slice(actionStart, actionEnd);
    expect(actionCss).toContain('display:grid!important;');
    expect(actionCss).toContain('place-items:center!important;');
    expect(actionCss).toContain('background:currentColor!important;');
  });

  it('verwendet fuer STRESS dasselbe Detail-Popover wie fuer TRAINING', () => {
    expect(entryDetail).toContain("container.classList.add('neo-dex-entry-view', 'food-dex-entry-view')");
    expect(entryDetail).toContain("['food-log', 'training', 'supps', 'stress', 'home'].includes(entry.root_key)");
  });

  it('registriert SUPPS als feste Coral-Wissensseite mit eigener Tapete', () => {
    expect(categoryIcons).toContain("supps: '#FF6B6B'");
    expect(categoryIcons).toContain("supps: 'wallpaper-supps'");
    expect(main).toContain("route === 'training' || route === 'supps'");
    expect(main).toContain("const pattern = isSupps ? 'wallpaper-supps' : 'wallpaper-dumbbell'");
    expect(entryDetail).toContain("supps: 'SUPPS'");
    expect(entryDetail).toContain("rootKey === 'supps'");
    expect(designSystem).toContain(':root[data-seite="supps"] :is(.neo-dex-page,.food-dex-page)::before');
  });

  it('verwendet auf COMP den weissen Kontrast und die gemeinsame Hero-Schrift', () => {
    expect(css).toContain('.app-dex-menu .menue-computer-text{fill:var(--dex-ink,#111)!important}');
    expect(css).toContain('color:var(--dex-ink,#fff)!important;');
    const heroStart = css.indexOf(':root[data-seite="body"] .body-v2-hero-value>small{');
    const heroEnd = css.indexOf('}', heroStart);
    const heroCss = css.slice(heroStart, heroEnd);
    expect(heroCss).toContain('font-family:"Work Sans"');
    expect(heroCss).toContain('font-style:italic!important;');
    expect(heroCss).toContain('font-weight:700!important;');
  });

  it('bindet die festen COMP- und STRESS-Tapeten statt der Alt-Motive ein', () => {
    expect(categoryIcons).toContain("body: 'wallpaper-comp'");
    expect(categoryIcons).toContain("stress: 'wallpaper-stress'");
    expect(main).toContain("applyPageLook('body', categoryColor('body'), 'wallpaper-comp')");
    expect(main).toContain("applyPageLook('stress', categoryColor('stress'), 'wallpaper-stress')");
    expect(css).toContain('--body-pattern:var(--dex-tapete,url("../MUSCLEDEX-TAPETEN/Comp.svg"))');
    expect(designSystem).toContain(':root[data-seite="stress"] .neo-dex-page.dex-tapete-datei .kategorie-scrollinhalt::before');
  });

  it('hellt auf den festgelegten dunklen Seiten die Logo-Silhouette auf', () => {
    expect(designSystem).toContain(':root:is([data-seite="body"],[data-seite="sleep"],[data-seite="habits"],[data-seite="reminders"],[data-seite="training"]) .app-dex-brand .brand');
    expect(designSystem).toContain('--sil-filter:brightness(0) invert(1)');
  });
});
