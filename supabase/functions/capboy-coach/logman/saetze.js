// Satz- und Level-Logik der Trainingsvorlage.
//
// Bewusst ein eigenes Modul ohne DOM und ohne Zustand: Hier entscheidet sich,
// wie viele Saetze auf welche Uebung fallen. Ein Fehler bliebe hier *stumm* –
// es stuende einfach eine falsche Zahl da, die niemand als falsch erkennt.
// Genau solche Stellen gehoeren unter Test, also muessen sie aufrufbar sein.

// Gesamt-Saetze des Blocks fuer ein Level. sets = [Level I, II, III].
export function targetSets(blk, tier) {
  return blk.sets[tier];
}

// Effektiver Set-Typ je Level: Am Cluster-Tag laufen Tris/Bis und Abs auf
// niedrigen Leveln als Pump statt als Cluster.
export function effTypeOf(blk, tier) {
  return (blk.typeByTier && blk.typeByTier[tier]) || blk.type;
}

// Uebungsfelder je Level: Der Quads+Hams-Pump hat auf Level I nur ein Feld.
export function exOf(blk, tier) {
  return (blk.exByTier && blk.exByTier[tier]) || blk.ex;
}

// Wechsel-Verteilung (nur Heavy-Bloecke): die N Gesamtsaetze des Muskels auf die
// Uebungen aufteilen. Die erste Uebung (Comp) bekommt den Rest, die zweite (Iso)
// den abgerundeten Anteil. Eine einzige Uebung bekommt alle N.
export function setsForExercise(blk, tier, xi) {
  const N = targetSets(blk, tier);
  const E = exOf(blk, tier).length || 1;
  return Math.floor(N / E) + (xi < (N % E) ? 1 : 0);
}

// Level III erhöht nichts automatisch. Zusatzsätze liegen deshalb direkt am
// jeweiligen Übungsfeld des aktuellen Cycles. Außerhalb von Level III werden
// sie aufbewahrt, aber weder angezeigt noch gezählt.
export function extraSets(entry, tier, xi) {
  if (tier !== 2) return 0;
  const wert = Number(entry?.extra?.[xi]);
  return Number.isFinite(wert) ? Math.max(0, Math.floor(wert)) : 0;
}
