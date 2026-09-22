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
  it('bindet die globale Wissenssuche mit dem gelieferten Seitenicon ein', () => {
    expect(main).toContain("const knowledgeSearchModule = () => import('./knowledgeSearch.js')");
    expect(main).toContain("['profile', 'coins', 'search'].includes(angefragt)");
    expect(main).toContain('aria-label="Wissen durchsuchen"');
    expect(designSystem).toContain('.app-dex-tab[data-sammlung="stress"] .app-dex-tab-icon{transform:scale(1.09)}');
  });

  it('verwendet CAPCOIN-Violett als Retro-Startfarbe und LOGMAN-Navy im Darkmode', () => {
    expect(indexHtml).toContain('<meta name="theme-color" content="#432C5E">');
    expect(indexHtml).toContain('background:#432C5E!important');
    expect(indexHtml).toContain('html[data-theme="dark"].app-booting');
    expect(indexHtml).toContain('background:#101A2B!important');
    expect(manifest).toContain('"background_color": "#432C5E"');
    expect(css).toContain(':root[data-seite="auth"] .auth-marquee{');
    expect(css).toContain('background:#fff!important;\n  color:#111!important;');
    expect(css).toContain(':root[data-seite="auth"] .auth-shell :is([data-auth-form],[data-recovery-form]){');
    expect(css).toContain('box-shadow:0 4px 0 #111!important;');
    expect(css).toContain('background:#432C5E!important;\n  color:#FFD400!important;');
  });

  it('installiert die PWA als CAPBOY mit dem freigegebenen CAPCOIN-Icon', () => {
    expect(manifest).toContain('"name": "CAPBOY"');
    expect(manifest).toContain('"short_name": "CAPBOY"');
    expect(manifest).toContain('"src": "capboy-icon-192-v10.png"');
    expect(manifest).toContain('"src": "capboy-icon-512-v10.png"');
    expect(manifest).not.toContain('"purpose": "any maskable"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-title" content="CAPBOY"');
    expect(indexHtml).toContain('rel="apple-touch-icon" href="./capboy-apple-touch-icon-v10.png"');
    expect(indexHtml).not.toContain('apple-touch-icon-precomposed');
    expect(indexHtml).toContain('href="./capboy-app-icon-v10.svg"');
  });

  it('entfernt die Auth-Ansicht beim ersten Rendern nach der Anmeldung', () => {
    const renderChromeStart = main.indexOf('function renderChrome()');
    const renderChromeEnd = main.indexOf('function ansichtMerken', renderChromeStart);
    const renderChrome = main.slice(renderChromeStart, renderChromeEnd);
    expect(renderChrome).toContain("app.querySelector(':scope > .auth-marquee')?.remove()");
    expect(renderChrome).toContain("app.querySelector(':scope > .auth-shell')?.remove()");
  });

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
    expect(designSystem).toContain(':root[data-seite="essen"] .neo-dex-page.dex-fixkopf>.wrap');
    expect(designSystem).toContain(':root[data-seite="supps"] .neo-dex-page.dex-fixkopf>.wrap');
    expect(designSystem).toContain(':root[data-seite="stress"] .neo-dex-page .kategorie-scrollinhalt');
    expect(designSystem).toContain('.neo-dex-page .sammlung-seite');
    expect(designSystem).toContain('.neo-dex-page :is(.dex-eintrag-listen,.dex-mehr-laden,.dex-sammlungskopf)');
    expect(designSystem).toContain('.neo-dex-page .unter-sammlungen-block>h2');
    expect(designSystem).toContain('padding-left:var(--cap-reference-inline)!important');
    expect(designSystem).toContain('width:100vw!important');
    expect(designSystem).toContain('margin-left:calc(50% - 50vw)!important');
    expect(designSystem).toContain(':root[data-seite="profile"] .profil-scrollinhalt');
    expect(designSystem).toContain('100vw - var(--cap-reference-inline) - var(--cap-reference-inline)');
  });

  it('kennzeichnet alle festen Rasterseiten als Wissenssammlung', () => {
    expect(main).toContain("const GRID_COLLECTION_ROOTS = new Set(['food-log', 'essen', 'supps', 'training', 'stress'])");
    expect(main).toContain('gridCollectionMastheadMarkup');
    expect(main).toContain('Wissenssammlung');
    expect(main).toContain("mountGridCollectionMasthead(view, { infoKind: 'food', title: 'REZEPTE' })");
    expect(main).toContain("mountGridCollectionMasthead(view, { infoKind: 'stress', title: 'MIND' })");
    expect(main).toContain('class="som-info-knopf" type="button" data-grid-collection-info');
    expect(designSystem).toContain('.neo-dex-page .dex-sammlungskopf{');
    expect(designSystem).toContain('.neo-dex-page .dex-sammlungskopf h1{');
    expect(designSystem).toContain('background:var(--ordner,var(--dex-seitenfarbe));');
    expect(designSystem).toContain('font:800 13px/1 var(--tech);');
  });

  it('vereinheitlicht Darkmode-Unterordner, Suchtreffer und Raster-Infos', () => {
    expect(designSystem).toContain('.dex-unterdex-fach .dex-ordner-form :is(');
    expect(designSystem).toContain('.dex-ordner-rueckblatt,.dex-ordner-farbblatt,.dex-ordner-front');
    expect(designSystem).toContain('fill:#fff!important;');
    expect(designSystem).toContain('#view:is(.neo-dex-page,.food-dex-page) .dex-unterdex-fach .dex-ordner-inhalt :is(h2,b,span)');
    expect(designSystem).toContain('-webkit-text-fill-color:#111!important;');
    expect(designSystem).toContain('.nutrition-search-results>button{');
    expect(designSystem).toContain('.grid-collection-info-help p{');
    expect(designSystem).toContain('font:500 11.5px/1.45 var(--tech)!important;');
  });

  it('haelt Header, Dock und Sheets global statt seitenspezifisch', () => {
    expect(designSystem).toContain('.app-dex-header-actions{gap:4px}');
    expect(designSystem).toContain('transform:translate(-2px,2px);');
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

  it('verwendet CAPCOIN-Violett in Retro, LOGMAN-Navy in Dark und eine weisse Silhouette im Splash', () => {
    const splashStart = css.indexOf('.app-start-splash{');
    const splashEnd = css.indexOf('.app-logo-font-ready', splashStart);
    const splashCss = css.slice(splashStart, splashEnd);
    expect(indexHtml).toContain('name="theme-color" content="#432C5E"');
    expect(indexHtml).toContain('background:#432C5E!important');
    expect(manifest).toContain('"background_color": "#432C5E"');
    expect(splashCss).toContain('background:#432C5E');
    expect(css).toContain(':root[data-theme="dark"] .app-start-splash{background:#101A2B}');
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

  it('verwendet fuer MIND dasselbe Detail-Popover wie fuer TRAINING', () => {
    expect(entryDetail).toContain("container.classList.add('neo-dex-entry-view', 'food-dex-entry-view')");
    expect(entryDetail).toContain("['food-log', 'essen', 'training', 'supps', 'stress', 'home'].includes(entry.root_key)");
  });

  it('registriert SUPPS als helle Thistle-Tiefviolett-Farbwelt mit eigener Tapete', () => {
    expect(categoryIcons).toContain("supps: '#D8BFD8'");
    expect(categoryIcons).toContain("supps: '#2A1E5C'");
    expect(categoryIcons).toContain("supps: 'wallpaper-supps'");
    expect(main).toContain("['essen', 'training', 'supps'].includes(route)");
    expect(main).toContain("supps: { title: 'SUPPS', pattern: 'wallpaper-supps' }");
    expect(entryDetail).toContain("supps: 'SUPPS'");
    expect(entryDetail).toContain("rootKey === 'supps'");
    expect(designSystem).toContain(':root[data-seite="supps"] :is(.neo-dex-page,.food-dex-page)::before');
    expect(designSystem).toContain('mask-size:700px auto!important');
    expect(designSystem).toContain('--supps-card:#FFFCF5;');
    expect(designSystem).toContain('--text:#2A1E5C;\n  --ink:#2A1E5C;');
    expect(designSystem).toContain('background:#2A1E5C!important;color:#D8BFD8!important;');
    expect(designSystem).toContain(':root[data-seite="supps"] .app-dex-brand .brand{--brand-outline:#0A1330;--sil-filter:none}');
  });

  it('verwendet auf EINKAUF das feste Butter-Dunkelgrün-Paar', () => {
    expect(categoryIcons).toContain("shopping: '#FFEFB3'");
    expect(categoryIcons).toContain("shopping: '#013E37'");
    expect(designSystem).toContain(':root[data-seite="shopping"]{--cap-card:#FFFCF5;');
    expect(designSystem).toContain('background-color:#FFEFB3!important');
    expect(designSystem).toContain('.einkauf-row input[type="checkbox"]{');
    expect(designSystem).toContain('background-color:#013E37!important;background-image:');
    expect(designSystem).toContain('.einkauf-add-form>button.btn-primary[type="submit"]{color:#FFEFB3!important;-webkit-text-fill-color:#FFEFB3!important}');
  });

  it('verwendet auf SCHLAF Midnight, einen Creme-Hero und neutrale weiße Karten', () => {
    expect(categoryIcons).toContain("sleep: '#0E1D47'");
    expect(categoryIcons).toContain("sleep: '#FFFCF3'");
    expect(designSystem).toContain(':root[data-seite="sleep"]{\n  --sleep-paper:#fff;\n  --cap-card:#fff;');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #FFFCF3');
    expect(designSystem).toContain('.sleep-tonight{border-color:#FFFCF3!important;color:#FFFCF3!important}');
    expect(designSystem).toContain(':root[data-seite="sleep"] .app-dex-brand .brand{\n  --brand-outline:#0A1330;\n  --sil-filter:brightness(0) invert(1);');
    expect(designSystem).toContain(':root[data-seite="sleep"] .sleep-chart polyline{\n  stroke:#0E1D47!important;');
  });

  it('haelt auf COMP alle Kontextmenue-Konturen neutral schwarz', () => {
    expect(designSystem).toContain(':root[data-seite="body"] :is(.body-add-overlay,.body-entry-overlay,.special-dex-overlay)');
    expect(designSystem).toContain('border-color:#000!important;');
  });

  it('verwendet auf MIND das feste Deep-Blush-Gelb-Paar mit lesbaren Karten', () => {
    expect(categoryIcons).toContain("stress: '#E36887'");
    expect(categoryIcons).toContain("stress: '#FFE08C'");
    expect(designSystem).toContain(':root[data-seite="stress"]{\n  --stress-card:#fff;');
    expect(designSystem).toContain('--stress-card-ink:#7A2940;');
    expect(designSystem).toContain('background:#E36887!important;');
    expect(designSystem).toContain('color:#FFE08C!important;');
    expect(designSystem).toContain('.dex-sammlungskopf-text :is(span,small)');
    expect(designSystem).toContain('.dex-detail-popup{\n  border-color:#000!important;\n  background:var(--stress-card)!important;');
  });

  it('verwendet für CAPCOINS leuchtendes Gelb und dunkles Violett', () => {
    expect(categoryIcons).toContain("coins: '#432C5E'");
    expect(categoryIcons).toContain("coins: '#FFD400'");
    expect(main).toContain("title: 'CAPCOINS'");
    expect(designSystem).toContain(':root[data-seite="coins"]{--coin-readable:#432C5E;--cap-card:#fff;');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #000;');
    expect(designSystem).toContain('background:#432C5E!important;color:#FFD400!important');
    expect(designSystem).toContain('--cap-tint:color-mix(in srgb,#FFD400 9%,#432C5E);');
    expect(designSystem).toContain(':root[data-seite="coins"] .app-dex-brand .brand{--brand-outline:#0A1330;--sil-filter:brightness(0) invert(1)}');
    expect(designSystem).toContain(':root[data-seite="coins"] .app-dex-header{--dex-ink:#fff;background:#432C5E!important;border-color:#fff!important;color:#fff!important}');
    expect(designSystem).toContain(':root[data-theme="dark"][data-seite="coins"] .coin-dex-page .coin-progress{\n  background:#697486!important;');
    expect(designSystem).toContain(':root:root[data-theme="dark"][data-seite="coins"] #view.coin-dex-page .coin-progress>i:not(.material-svg){\n  background:#FFFFFF!important;\n  background-color:#FFFFFF!important;');
  });

  it('hält PROFIL als neutrale warme Systemseite', () => {
    expect(categoryIcons).toContain("profile: '#F7F3EA'");
    expect(categoryIcons).toContain("profile: '#0A1330'");
    expect(designSystem).toContain(':root[data-seite="profile"]{--profile-accent:#0A1330!important;');
    expect(designSystem).toContain('--akzent-ink:#FFFCF5!important;');
    expect(designSystem).toContain(':root[data-seite="profile"] .app-dex-brand .brand{--brand-outline:#0A1330;--sil-filter:none}');
  });

  it('registriert ESSEN als feste Cinnamon-Wissensseite mit eigener Tapete', () => {
    expect(categoryIcons).toContain("essen: '#945B39'");
    expect(categoryIcons).toContain("essen: 'wallpaper-essen'");
    expect(main).toContain("essen: { title: 'ESSEN', pattern: 'wallpaper-essen' }");
    expect(entryDetail).toContain("essen: 'ESSEN'");
    expect(entryDetail).toContain("rootKey === 'essen'");
    expect(designSystem).toContain(':root[data-seite="essen"] :is(.neo-dex-page,.food-dex-page)::before');
  });

  it('verwendet auf COMP das feste Cotton-Cloud-Pink-Paar und die gemeinsame Hero-Schrift', () => {
    expect(css).toContain('.app-dex-menu .menue-computer-text{fill:var(--dex-ink,#111)!important}');
    expect(categoryIcons).toContain("body: '#94DEFF'");
    expect(categoryIcons).toContain("body: '#FF277F'");
    expect(designSystem).toContain(':root[data-seite="body"]{');
    expect(designSystem).toContain('--cap-card-border:1.5px solid var(--dex-ink,#FF277F)');
    expect(designSystem).toContain('color:var(--dex-accent-ink,#94DEFF)!important;');
    const heroStart = css.indexOf(':root[data-seite="body"] .body-v2-hero-value>small{');
    const heroEnd = css.indexOf('}', heroStart);
    const heroCss = css.slice(heroStart, heroEnd);
    expect(heroCss).toContain('font-family:"Work Sans"');
    expect(heroCss).toContain('font-style:italic!important;');
    expect(heroCss).toContain('font-weight:700!important;');
  });

  it('verwendet auf TRACKER das feste Soft-Blush-Braun-Paar', () => {
    expect(categoryIcons).toContain("reminders: '#FFEDE3'");
    expect(categoryIcons).toContain("reminders: '#49251E'");
    expect(designSystem).toContain(':root[data-seite="reminders"]{');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #49251E;');
    expect(designSystem).toContain('background:color-mix(in srgb,#49251E 7%,#FFFCF5)!important;');
    expect(designSystem).toContain('.nutrition-calibration-info :is(.material-svg,svg,svg *){\n  color:#fff!important;');
    expect(designSystem).toContain('.mahl-mini-switch input:checked+.mahl-mini-switch-track::after{\n  background:#fff!important;');
  });

  it('verwendet auf TRAINING das feste Slate-Pfirsich-Paar', () => {
    expect(categoryIcons).toContain("training: '#203C3D'");
    expect(categoryIcons).toContain("training: '#F9DBBA'");
    expect(designSystem).toContain(':root[data-seite="training"]{');
    expect(designSystem).toContain('--cap-card:#fff;');
    expect(designSystem).toContain('--text:#203C3D;\n  --ink:#203C3D;');
    expect(designSystem).toContain('border-color:#000!important;');
    expect(designSystem).toContain('filter:drop-shadow(2px 2px 0 #000)!important;');
    expect(designSystem).toContain('filter:drop-shadow(0 3.5px 0 #000)!important;');
    expect(designSystem).toContain('stroke:#000!important;');
    expect(designSystem).toContain('background:#fff!important;color:#203C3D!important;');
    expect(designSystem).toContain('.dex-detail-popup{border-color:#000!important;background:#fff!important;color:#203C3D!important}');
    expect(designSystem).toContain('background:#203C3D!important;color:#F9DBBA!important;');
    expect(designSystem).toContain('color:#F9DBBA!important;fill:currentColor!important;');
  });

  it('verwendet auf REZEPTE das feste Honey-Dawn-Paar nach den Grid-Regeln', () => {
    expect(categoryIcons).toContain("'food-log': '#F0C987'");
    expect(categoryIcons).toContain("'food-log': '#3C153B'");
    expect(designSystem).toContain(':root[data-seite="food-log"]{');
    expect(designSystem).toContain('--cap-card:#FFFCF5;');
    expect(designSystem).toContain('background:#FFFCF5!important;\n  color:#3C153B!important;');
    expect(designSystem).toContain('background:#F0C987!important;\n  color:#3C153B!important;');
    expect(designSystem).toContain('fill:#FFFCF5!important;');
  });

  it('verwendet auf ESSEN Cinnamon und Warmweiß nach den Grid-Regeln', () => {
    expect(categoryIcons).toContain("essen: '#945B39'");
    expect(categoryIcons).toContain("essen: '#F6EFE9'");
    expect(designSystem).toContain(':root[data-seite="essen"] :is(.neo-dex-page,.food-dex-page){');
    expect(designSystem).toContain('background-color:#945B39!important');
    expect(designSystem).toContain('background:#945B39!important;color:#F6EFE9!important');
    expect(designSystem).toContain(':root[data-seite="essen"] .app-dex-brand .brand{--brand-outline:#0A1330;--sil-filter:brightness(0) invert(1)}');
  });

  it('verwendet auf ROUTINEN Tekhelet und warmes Creme nach den Hero-Regeln', () => {
    expect(categoryIcons).toContain("habits: '#3F236F'");
    expect(categoryIcons).toContain("habits: '#FFF8ED'");
    expect(designSystem).toContain(':root[data-seite="habits"]{');
    expect(designSystem).toContain('--routine-panel:#FFF8ED;');
    expect(designSystem).toContain('background:var(--routine-panel)!important;color:#3F236F!important}');
    expect(designSystem).toContain('--cap-card:#fff;');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #FFF8ED;');
    expect(designSystem).toContain('background:#FFF8ED!important}');
    expect(designSystem).toContain('background:#3F236F!important;color:#FFF8ED!important;');
    expect(designSystem).toContain(':is(.routine-days,.routine-duration) button{');
    expect(designSystem).toContain('.routine-meta{');
    expect(designSystem).toContain('.routine-meta small{');
    expect(designSystem).toContain(':is(.routine-days,.routine-duration) button.aktiv{');
    expect(designSystem).toContain('button.btn.btn-primary[type="submit"]{');
    expect(designSystem).toContain('button.routine-start :is(.material-svg,svg,svg *){');
    expect(designSystem).toContain('.routine-timer-exercises li>span{');
    expect(designSystem).toContain('-webkit-text-fill-color:#FFF8ED!important;');
  });

  it('hält App-Rahmen und Menüflächen neutral und färbt nur deren Aktionen', () => {
    expect(designSystem).toContain('--dex-ink:#0A1330;');
    expect(designSystem).toContain('border-color:#0A1330!important;');
    expect(designSystem).toContain(':is(.special-dex-sheet,.kategorie-sheet){');
    expect(designSystem).toContain('background:#fff!important;\n  color:#111!important;');
    expect(designSystem).toContain('background:transparent!important;\n  color:#111!important;');
    expect(designSystem).toContain('border-color:#000!important;\n  background:var(--dex-seitenfarbe)!important;\n  color:var(--dex-ink)!important;');
  });

  it('bindet die festen COMP- sowie getauschten ROUTINEN- und MIND-Tapeten ein', () => {
    expect(categoryIcons).toContain("body: 'wallpaper-comp'");
    expect(categoryIcons).toContain("habits: 'wallpaper-stress'");
    expect(categoryIcons).toContain("stress: 'wallpaper-wolke'");
    expect(main).toContain("applyPageLook('body', categoryColor('body'), 'wallpaper-comp')");
    expect(main).toContain("applyPageLook('stress', categoryColor('stress'), 'wallpaper-wolke')");
    expect(css).toContain('--body-pattern:var(--dex-tapete,url("../MUSCLEDEX-TAPETEN/Comp.svg"))');
    expect(designSystem).toContain(':root[data-seite="stress"] .neo-dex-page.dex-tapete-datei .kategorie-scrollinhalt::before');
  });

  it('hellt auf den festgelegten dunklen Seiten die Logo-Silhouette auf', () => {
    expect(designSystem).toContain(':root:is([data-seite="sleep"],[data-seite="training"]) .app-dex-brand .brand');
    expect(designSystem).not.toContain(':root:is([data-seite="body"],[data-seite="essen"]');
    expect(designSystem).toContain('--sil-filter:brightness(0) invert(1)');
  });

  it('rastet das horizontale App-Menü auf vollständigen Tabs ein', () => {
    /* Das zwingende Einrasten ist bewusst entfallen: zusammen mit
       "scroll-snap-stop:always" hielt jeder Wisch beim naechsten Reiter an,
       was sich zaeh anfuehlte. Die Leiste laeuft jetzt frei aus; ins Bild
       geholt wird der aktive Reiter weiterhin per Skript. */
    expect(css).not.toContain('scroll-snap-type:x mandatory;');
    expect(css).not.toContain('scroll-snap-stop:always;');
    // Ohne Luft im Scrollbereich schneidet overflow-y:hidden die drei Punkte
    // und den Druckeffekt ab.
    expect(css).toContain('padding-block:4px;');
    // Es wird weiterhin auf einen Reiteranfang eingerastet …
    expect(main).toContain('const eingerastet = rasterpunkte.reduce');
    // … das Ergebnis aber so begrenzt, dass der aktive Reiter im Bild bleibt.
    // Ohne diese Grenze rutschten EINKAUF und MIND aus dem Fenster – seit sie
    // selbst das Menü öffnen, müssen sie sichtbar sein.
    expect(main).toContain('const sicher = Math.min(Math.max(eingerastet, untergrenze), obergrenze)');
    expect(main).toContain('tabLeiste.scrollTo({ left: sicher');
    expect(main).not.toContain("aktiv.scrollIntoView({ behavior: 'smooth'");
  });

  /* Der MENÜ-Knopf rechts im Dock ist entfallen; seine Aufgabe übernimmt ein
     zweiter Tipp auf den Reiter der offenen Seite. Beides gehört zusammen:
     ohne den Knopf UND ohne diesen Tipp gäbe es keinen Weg mehr, etwas
     anzulegen. */
  it('ersetzt den MENÜ-Knopf durch den Reiter der offenen Seite', () => {
    expect(main).not.toContain('class="app-dex-menu"');
    // Die Leiste bekommt die volle Breite: keine zweite Spalte mehr.
    expect(css).toContain('grid-template-columns:minmax(0,1fr);');
    // Der Hinweis am offenen Reiter braucht Elternteil UND Klasse, sonst
    // gewinnt ".app-dex-tab>span" mit seinen 29x29 px.
    expect(css).toContain('.app-dex-tab>.app-dex-tab-punkte');
    expect(main).toContain('app-dex-tab-punkte');
    expect(main).toContain("view.querySelector('.kategorie-plus')?.click()");
  });
});
