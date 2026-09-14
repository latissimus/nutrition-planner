import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workbook = `${root}Seminarunterlagen/Hautfalten/Formel.xlsx`;
const formelDaten = JSON.parse(readFileSync(`${root}src/data/ypsi-formel.json`, 'utf8'));

const xml = (member) => execFileSync('unzip', ['-p', workbook, member], {
  encoding: 'utf8',
  maxBuffer: 4 * 1024 * 1024,
});

const tracking = xml('xl/worksheets/sheet2.xml');
const grafik = xml('xl/worksheets/sheet3.xml');
const person = xml('xl/worksheets/sheet1.xml');

const decodeXml = (value = '') => value
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&');

const cell = (sheet, address) => {
  const match = sheet.match(new RegExp(`<c\\b[^>]*\\br="${address}"[^>]*>([\\s\\S]*?)<\\/c>`));
  if (!match) throw new Error(`Formel.xlsx: Zelle ${address} wurde nicht gefunden.`);
  return match[1];
};

const value = (sheet, address) => {
  const match = cell(sheet, address).match(/<v>([\s\S]*?)<\/v>/);
  if (!match) throw new Error(`Formel.xlsx: ${address} enthält keinen Zahlenwert.`);
  return Number(decodeXml(match[1]));
};

const formula = (sheet, address) => {
  const match = cell(sheet, address).match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
  if (!match) throw new Error(`Formel.xlsx: ${address} enthält keine auslesbare Formel.`);
  return decodeXml(match[1]);
};

const assertSharedRange = (sheet, address, expectedRange) => {
  const match = cell(sheet, address).match(/<f\b([^>]*)>/);
  if (!match || !match[1].includes(`ref="${expectedRange}"`)) {
    throw new Error(`Formel.xlsx ${address}: geteilter Formelbereich ${expectedRange} fehlt.`);
  }
};

const assertEqual = (actual, expected, label) => {
  if (!Object.is(actual, expected)) throw new Error(`${label}: erwartet ${expected}, gefunden ${actual}`);
};

const assertClose = (actual, expected, label) => {
  if (Math.abs(actual - expected) > 1e-12) throw new Error(`${label}: erwartet ${expected}, gefunden ${actual}`);
};

const assertFormula = (sheet, address, expected) => assertEqual(formula(sheet, address), expected, `Formel.xlsx ${address}`);

const constants = ['J7', 'J8', 'J9', 'J10', 'K9', 'K10', 'L9', 'L10', 'M10', 'O10', 'P10'];
for (const address of constants) {
  assertEqual(value(tracking, address), formelDaten.konstanten[address], `Konstante ${address}`);
}

assertFormula(person, 'C24', 'IF(C22="","",DATEDIF(C22,TODAY(),"y"))');
assertFormula(tracking, 'C14', 'IF(B14="","",DATEDIF(Person!$C$22,B14,"y"))');
assertFormula(tracking, 'W14', 'IF(J14="","",SUM(J14:S14))');
assertFormula(tracking, 'H14', 'IF(F14="","",IF(E14="","",IF(W14="","",$O$10*(($K$9*F14^$K$10)*($L$9*E14^$L$10)*(ABS(W14-(($J$8*E14^$J$9)*F14^$J$10+$J$7)))^$M$10)+$P$10)))');
assertFormula(tracking, 'G14', 'IF(F14="","",IF(E14="","",IF(W14="","",F14*(100%-H14/100))))');
assertFormula(tracking, 'J15', 'IF(ISERROR(Grafik!D51),"",Grafik!D51)');
assertFormula(tracking, 'V15', 'IF(ISERROR(Grafik!P51),"",Grafik!P51)');
assertFormula(grafik, 'D50', 'IF(Tracking!J14="","",IF(Person!$C$20="m",ABS((Tracking!J14/4-D$45)),ABS((Tracking!J14/4-D$48))))');
assertFormula(grafik, 'D45', 'AVERAGE(D44,D46)');
assertFormula(grafik, 'D48', 'AVERAGE(D47,D49)');
assertSharedRange(grafik, 'D45', 'D45:P45');
assertSharedRange(grafik, 'D48', 'D48:P48');
assertFormula(grafik, 'R50', 'IF(ISERROR(LARGE($D50:$P50,R$44)),"",LARGE($D50:$P50,R$44))');
assertSharedRange(grafik, 'R50', 'R50:AD50');
assertFormula(grafik, 'D51', 'IF(D50="","",IF(D50=$R50,1,IF(D50=$S50,2,IF(D50=$T50,3,IF(D50=$U50,4,IF(D50=$V50,5,IF(D50=$W50,6,IF(D50=$X50,7,IF(D50=$Y50,8,IF(D50=$Z50,9,IF(D50=$AA50,10,IF(D50=$AB50,11,IF(D50=$AC50,12,IF(D50=$AD50,13))))))))))))))');
assertSharedRange(grafik, 'D51', 'D51:P51');

const columns = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
const slugs = ['kinn', 'wange', 'brust', 'trizeps', 'ruecken', 'rippe', 'huefte', 'bauch', 'knie', 'wade', 'quadrizeps', 'beinbizeps', 'bizeps'];
for (const [sex, rows] of [['mann', [44, 45, 46]], ['frau', [47, 48, 49]]]) {
  for (let index = 0; index < columns.length; index += 1) {
    const reference = formelDaten.referenzen[sex][slugs[index]];
    for (const [key, row] of [['min', rows[0]], ['mittel', rows[1]], ['max', rows[2]]]) {
      const expected = key === 'mittel' ? (reference.min + reference.max) / 2 : reference[key];
      assertClose(value(grafik, `${columns[index]}${row}`), expected, `${sex} ${slugs[index]} ${key}`);
    }
  }
}

console.log('YPSI-Formelprüfung erfolgreich: Arbeitsmappe, Konstanten, Referenzen und Codebasis stimmen überein.');
