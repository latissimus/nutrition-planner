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

  it('verwendet fuer MIND dasselbe Detail-Popover wie fuer TRAINING', () => {
    expect(entryDetail).toContain("container.classList.add('neo-dex-entry-view', 'food-dex-entry-view')");
    expect(entryDetail).toContain("['food-log', 'essen', 'training', 'supps', 'stress', 'home'].includes(entry.root_key)");
  });

  it('registriert SUPPS als Chocolate-Hellblau-Farbwelt mit eigener Tapete', () => {
    expect(categoryIcons).toContain("supps: '#47230F'");
    expect(categoryIcons).toContain("supps: '#B5D0F3'");
    expect(categoryIcons).toContain("supps: 'wallpaper-supps'");
    expect(main).toContain("['essen', 'training', 'supps'].includes(route)");
    expect(main).toContain("supps: { title: 'SUPPS', pattern: 'wallpaper-supps' }");
    expect(entryDetail).toContain("supps: 'SUPPS'");
    expect(entryDetail).toContain("rootKey === 'supps'");
    expect(designSystem).toContain(':root[data-seite="supps"] :is(.neo-dex-page,.food-dex-page)::before');
    expect(designSystem).toContain('mask-size:700px auto!important');
    expect(designSystem).toContain('--supps-card:color-mix(in srgb,#B5D0F3 68%,#FFFCF5);');
    expect(designSystem).toContain('--text:#47230F;\n  --ink:#B5D0F3;');
    expect(designSystem).toContain('background:#47230F!important;color:#B5D0F3!important;');
  });

  it('verwendet auf EINKAUF das feste Soft-Blush-Braun-Paar', () => {
    expect(categoryIcons).toContain("shopping: '#FFEDE3'");
    expect(categoryIcons).toContain("shopping: '#49251E'");
    expect(designSystem).toContain(':root[data-seite="shopping"]{\n  --cap-card:#FFFCF5;');
    expect(designSystem).toContain('background:#FFEDE3!important;\n  color:#49251E!important;');
    expect(designSystem).toContain('.einkauf-row input[type="checkbox"]{');
    expect(designSystem).toContain('border:2px solid #49251E!important;');
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
    expect(designSystem).toContain(':root[data-seite="stress"]{\n  --stress-card:color-mix(in srgb,#FFE08C 58%,#FFFCF5);');
    expect(designSystem).toContain('--stress-card-ink:#7A2940;');
    expect(designSystem).toContain('background:#E36887!important;');
    expect(designSystem).toContain('color:#FFE08C!important;');
    expect(designSystem).toContain('.dex-sammlungskopf-text :is(span,small)');
    expect(designSystem).toContain('box-shadow:none!important;');
  });

  it('verwendet für CAPSTARS eine neutrale Navy-/Belohnungswelt', () => {
    expect(categoryIcons).toContain("coins: '#0A1330'");
    expect(categoryIcons).toContain("coins: '#FFE88A'");
    expect(main).toContain("title: 'CAPSTARS'");
    expect(designSystem).toContain(':root[data-seite="coins"]{\n  --cap-card:#fff;');
    expect(designSystem).toContain('background:color-mix(in srgb,#FFE88A 10%,#0A1330)!important;');
    expect(designSystem).toContain(':root[data-seite="coins"] .app-dex-brand .brand{\n  --brand-outline:#0A1330;\n  --sil-filter:brightness(0) invert(1);');
  });

  it('hält PROFIL als neutrale warme Systemseite', () => {
    expect(categoryIcons).toContain("profile: '#F7F3EA'");
    expect(categoryIcons).toContain("profile: '#0A1330'");
    expect(designSystem).toContain(':root[data-seite="profile"]{--profile-accent:#0A1330!important;');
    expect(designSystem).toContain('--akzent-ink:#FFFCF5!important;');
    expect(designSystem).toContain(':root[data-seite="profile"] .app-dex-brand .brand{--brand-outline:#0A1330;--sil-filter:none}');
  });

  it('registriert ESSEN als feste Burgundy-Wissensseite mit eigener Tapete', () => {
    expect(categoryIcons).toContain("essen: '#3C153B'");
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

  it('verwendet auf TRACKER das feste Butternut-Dunkelrot-Paar', () => {
    expect(categoryIcons).toContain("reminders: '#FFA175'");
    expect(categoryIcons).toContain("reminders: '#5C0702'");
    expect(designSystem).toContain(':root[data-seite="reminders"]{');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #5C0702;');
    expect(designSystem).toContain('background:#5C0702!important;\n  color:#FFA175!important;');
    expect(designSystem).toContain('.nutrition-calibration-info{\n  color:#fff!important;');
    expect(designSystem).toContain('.mahl-mini-switch input:checked+.mahl-mini-switch-track::after{\n  background:#fff!important;');
  });

  it('verwendet auf TRAINING das feste Slate-Pfirsich-Paar', () => {
    expect(categoryIcons).toContain("training: '#203C3D'");
    expect(categoryIcons).toContain("training: '#F9DBBA'");
    expect(designSystem).toContain(':root[data-seite="training"]{');
    expect(designSystem).toContain('--cap-card:#F9DBBA;');
    expect(designSystem).toContain('--text:#203C3D;\n  --ink:#203C3D;');
    expect(designSystem).toContain('border-color:#000!important;');
    expect(designSystem).toContain('filter:drop-shadow(2px 2px 0 #000)!important;');
    expect(designSystem).toContain('filter:drop-shadow(0 3.5px 0 #000)!important;');
    expect(designSystem).toContain('stroke:#000!important;');
    expect(designSystem).toContain('background:#F9DBBA!important;color:#203C3D!important;');
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

  it('kehrt auf ESSEN das Honey-Dawn-Paar nach den Grid-Regeln um', () => {
    expect(categoryIcons).toContain("essen: '#3C153B'");
    expect(categoryIcons).toContain("essen: '#F0C987'");
    expect(designSystem).toContain(':root[data-seite="essen"] :is(.neo-dex-page,.food-dex-page){');
    expect(designSystem).toContain('background:#F0C987!important;\n  color:#3C153B!important;');
    expect(designSystem).toContain('background:#3C153B!important;\n  color:#F0C987!important;');
  });

  it('verwendet auf ROUTINEN Twilight Berry und Gelb nach den Hero-Regeln', () => {
    expect(categoryIcons).toContain("habits: '#4F5B8C'");
    expect(categoryIcons).toContain("habits: '#EDEBA4'");
    expect(designSystem).toContain(':root[data-seite="habits"]{');
    expect(designSystem).toContain('--routine-panel:color-mix(in srgb,#EDEBA4 90%,#4F5B8C);');
    expect(designSystem).toContain('background:var(--routine-panel)!important;color:#4F5B8C!important}');
    expect(designSystem).toContain('--cap-card:#FFFCF5;');
    expect(designSystem).toContain('--cap-card-border:1.5px solid #EDEBA4;');
    expect(designSystem).toContain('background:#4F5B8C!important;color:#EDEBA4!important;');
    expect(designSystem).toContain(':is(.routine-days,.routine-duration) button.aktiv{');
    expect(designSystem).toContain('button.btn.btn-primary[type="submit"]{');
    expect(designSystem).toContain('button.routine-start :is(.material-svg,svg,svg *){');
    expect(designSystem).toContain('.routine-timer-exercises li>span{');
    expect(designSystem).toContain('-webkit-text-fill-color:#EDEBA4!important;');
  });

  it('hält App-Rahmen und Menüflächen neutral und färbt nur deren Aktionen', () => {
    expect(designSystem).toContain('--dex-ink:#0A1330;');
    expect(designSystem).toContain('border-color:#0A1330!important;');
    expect(designSystem).toContain(':is(.special-dex-sheet,.kategorie-sheet){');
    expect(designSystem).toContain('background:#fff!important;\n  color:#111!important;');
    expect(designSystem).toContain('background:transparent!important;\n  color:#111!important;');
    expect(designSystem).toContain('border-color:#000!important;\n  background:var(--dex-seitenfarbe)!important;\n  color:var(--dex-ink)!important;');
  });

  it('bindet die festen COMP- und MIND-Tapeten statt der Alt-Motive ein', () => {
    expect(categoryIcons).toContain("body: 'wallpaper-comp'");
    expect(categoryIcons).toContain("stress: 'wallpaper-stress'");
    expect(main).toContain("applyPageLook('body', categoryColor('body'), 'wallpaper-comp')");
    expect(main).toContain("applyPageLook('stress', categoryColor('stress'), 'wallpaper-stress')");
    expect(css).toContain('--body-pattern:var(--dex-tapete,url("../MUSCLEDEX-TAPETEN/Comp.svg"))');
    expect(designSystem).toContain(':root[data-seite="stress"] .neo-dex-page.dex-tapete-datei .kategorie-scrollinhalt::before');
  });

  it('hellt auf den festgelegten dunklen Seiten die Logo-Silhouette auf', () => {
    expect(designSystem).toContain(':root:is([data-seite="essen"],[data-seite="sleep"],[data-seite="habits"],[data-seite="training"],[data-seite="supps"]) .app-dex-brand .brand');
    expect(designSystem).not.toContain(':root:is([data-seite="body"],[data-seite="essen"]');
    expect(designSystem).toContain('--sil-filter:brightness(0) invert(1)');
  });

  it('rastet das horizontale App-Menü auf vollständigen Tabs ein', () => {
    expect(css).toContain('scroll-snap-type:x mandatory;');
    expect(css).toContain('scroll-snap-align:start;');
    expect(main).toContain("tabLeiste.scrollTo({ left: eingerastet");
    expect(main).not.toContain("aktiv.scrollIntoView({ behavior: 'smooth'");
  });
});
