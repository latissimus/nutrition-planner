// A target comparison describes logged intake, not whether every meal was logged.
export const berlinDay = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export function targetPhaseDay(settings) {
  const stamp = settings?.target_changed_at;
  const date = stamp ? new Date(stamp) : null;
  return date && !Number.isNaN(date.getTime()) ? berlinDay(date) : null;
}

export function currentCalorieTarget(settings, weightKg, now = new Date()) {
  const custom = Number(settings?.custom_calorie_target);
  if (Number.isFinite(custom) && custom > 0) return custom;
  const adaptive = Number(settings?.adaptive_target);
  if (Number.isFinite(adaptive) && adaptive > 0) return adaptive;
  const weight = Number(weightKg);
  const height = Number(settings?.height_cm);
  const birth = String(settings?.birth_date || '');
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(height) || height <= 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const today = berlinDay(now);
  const [year, month, day] = today.split('-').map(Number);
  const [birthYear, birthMonth, birthDay] = birth.split('-').map(Number);
  const age = year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
  if (age < 14 || age > 100) return null;
  const resting = 10 * weight + 6.25 * height - 5 * age + (settings?.calculation_basis === 'female' ? -161 : 5);
  const pal = Number(settings?.pal) || 1.6;
  const adjustments = { lose: -300, maintain: 0, gain: 200, gain_fast: 350, bodycomp: 0 };
  return Math.round(Math.max(1200, resting * pal + (adjustments[settings?.goal] || 0)));
}

export function nutritionTargetStatus(enteredKcal, targetKcal, hasEntries = true) {
  const target = Number(targetKcal);
  if (!Number.isFinite(target) || target <= 0) return 'kein_ziel';
  if (!hasEntries) return 'keine_eintraege';
  const entered = Number(enteredKcal);
  if (!Number.isFinite(entered) || entered < 0) return 'keine_eintraege';
  if (entered < target * 0.9) return 'unter_zielbereich';
  if (entered > target * 1.1) return 'ueber_zielbereich';
  return 'im_zielbereich';
}
