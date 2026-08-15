import { supabase } from './supabase.js';
import { categoryColor, materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';
import { notifyCoinBalanceChanged } from './realtime.js';
import muscleCoinUrl from '../MUSCLE-COIN Neu.svg';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const muscleCoinMarkup = (className = '') => `
  <span class="muscle-coin ${className}" aria-hidden="true"><img src="${muscleCoinUrl}" alt=""></span>`;

export function routineCoinValue(templateType, durationMinutes, customValue = 5) {
  const duration = Number(durationMinutes || 0);
  if (templateType === 'meditation') return ({ 2: 2, 5: 4, 10: 7, 15: 10, 20: 12 })[duration] || 4;
  if (templateType === 'mobility') return duration >= 15 ? 10 : 6;
  if (templateType === 'walk') return ({ 15: 8, 30: 12, 45: 16, 60: 20 })[duration] || 8;
  return Math.max(0, Math.min(50, Number(customValue ?? 5)));
}

function nextReward(rewards, balance) {
  const active = rewards.filter((item) => item.active).sort((a, b) => a.cost - b.cost);
  return active.find((item) => item.cost > balance) || active[0] || null;
}

export async function loadCoinSummary(userId, signal) {
  try {
    const balanceQuery = supabase.rpc('muscle_coin_balance');
    let rewardsQuery = supabase.from('muscle_rewards').select('id,name,cost,active').eq('user_id', userId).eq('active', true).order('cost');
    if (signal) rewardsQuery = rewardsQuery.abortSignal(signal);
    const [{ data: balanceData, error }, { data: rewards, error: rewardError }] = await Promise.all([balanceQuery, rewardsQuery]);
    if (error || rewardError) throw error || rewardError;
    const balance = Number(balanceData || 0);
    const next = nextReward(rewards || [], balance);
    return { balance, next, available: true };
  } catch {
    // Vor dem Einspielen der Migration bleibt Home voll benutzbar. Die
    // Wallet zeigt dann nur einen neutralen Startwert.
    return { balance: 0, next: null, available: false };
  }
}

export function coinHeaderMarkup(summary) {
  return `<a class="coin-kopfstand" href="#coins" aria-label="MUSCLE-COINS öffnen, aktueller Kontostand ${summary.balance}">
    <strong>${summary.balance}</strong>
    ${muscleCoinMarkup('coin-kopf-symbol')}
  </a>`;
}

function coinEarningOverview() {
  const group = (title, icon, values) => `<div class="coin-verdienst-gruppe"><span class="coin-verdienst-titel"><i>${icon}</i><b>${title}</b></span><div>${values.map(([label, coins]) => `<span><small>${label}</small><strong>${coins}${muscleCoinMarkup('coin-wert-symbol')}</strong></span>`).join('')}</div></div>`;
  return `<details class="coin-verdienst">
    <summary><span><b>So verdienst du Coins</b><small>Vergütung anzeigen</small></span>${materialIconMarkup('chevron_right')}</summary>
    <div class="coin-verdienst-inhalt">
      <small class="coin-verdienst-hinweis">Je Routine und geplantem Tag einmal</small>
      ${group('Meditation', '🧘', [['2 min', 2], ['5 min', 4], ['10 min', 7], ['15 min', 10], ['20 min', 12]])}
      ${group('Mobility', '🤸', [['5–10 min', 6], ['15–20 min', 10]])}
      ${group('Spaziergang', '🚶', [['15 min', 8], ['30 min', 12], ['45 min', 16], ['60 min', 20]])}
      ${group('Schlaf', '🌙', [['Morgen-Check-in', 3]])}
      <div class="coin-verdienst-frei"><span>✨</span><p><b>Freie Routine</b><small>Beim Anlegen selbst zwischen 0 und 50 Coins festlegen. Standard: 5 Coins.</small></p></div>
    </div>
  </details>`;
}

function closeOverlay(backdrop) {
  backdrop?.remove();
}

function rewardEditor({ userId, existing = null, onSaved }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop coin-editor-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet coin-editor" role="dialog" aria-modal="true" aria-label="Belohnung ${existing ? 'bearbeiten' : 'anlegen'}">
    <header><h2>${existing ? 'Belohnung bearbeiten' : 'Neue Belohnung'}</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <form data-coin-reward-form>
      <label class="dex-entry-field"><span>Belohnung</span><input class="input" data-reward-name maxlength="80" value="${escapeHtml(existing?.name || '')}" placeholder="z. B. Lieblingssnack" required></label>
      <label class="dex-entry-field"><span>Preis in MUSCLE-COINS</span><input class="input coin-zahlenfeld" data-reward-cost type="number" inputmode="numeric" min="1" max="100000" value="${existing?.cost || 100}" required></label>
      <label class="dex-entry-field"><span>Notiz <small>optional</small></span><textarea class="input" data-reward-note maxlength="500" rows="3" placeholder="Womit möchtest du dich belohnen?">${escapeHtml(existing?.note || '')}</textarea></label>
      <label class="dex-entry-field"><span>Link <small>optional</small></span><input class="input" data-reward-link type="url" inputmode="url" value="${escapeHtml(existing?.link_url || '')}" placeholder="https://…"></label>
      <button class="btn btn-primary btn-block" type="submit">Belohnung speichern</button>
      ${existing ? '<button class="btn btn-block coin-reward-delete" type="button" data-reward-delete>Belohnung löschen</button>' : ''}
    </form>
  </section>`;
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) closeOverlay(backdrop); };
  backdrop.querySelector('[data-coin-reward-form]').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const payload = {
      user_id: userId,
      name: form.querySelector('[data-reward-name]').value.trim(),
      cost: Number(form.querySelector('[data-reward-cost]').value),
      note: form.querySelector('[data-reward-note]').value.trim(),
      link_url: form.querySelector('[data-reward-link]').value.trim() || null,
    };
    const query = existing
      ? supabase.from('muscle_rewards').update(payload).eq('id', existing.id).eq('user_id', userId)
      : supabase.from('muscle_rewards').insert(payload);
    const { error } = await query;
    if (error) { toast('Belohnung konnte nicht gespeichert werden.'); submit.disabled = false; return; }
    closeOverlay(backdrop); toast('Belohnung gespeichert'); await onSaved?.();
  };
  backdrop.querySelector('[data-reward-delete]')?.addEventListener('click', async () => {
    if (!confirm(`„${existing.name}“ wirklich löschen?`)) return;
    const { error } = await supabase.from('muscle_rewards').delete().eq('id', existing.id).eq('user_id', userId);
    if (error) return toast('Belohnung konnte nicht gelöscht werden.');
    closeOverlay(backdrop); toast('Belohnung gelöscht'); await onSaved?.();
  });
  document.body.append(backdrop);
}

function rewardMarkup(item, balance) {
  const percent = Math.min(100, Math.round((balance / item.cost) * 100));
  return `<article class="coin-reward" data-reward-id="${item.id}">
    <div class="coin-reward-kopf">${muscleCoinMarkup('coin-reward-symbol')}<span><b>${escapeHtml(item.name)}</b><small>${item.cost} Coins</small></span><strong>${percent}%</strong></div>
    <div class="coin-progress"><i style="width:${percent}%"></i></div>
    ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
    <div class="coin-reward-actions">
      <button type="button" data-reward-edit>Bearbeiten</button>
      <button type="button" class="coin-redeem" data-reward-redeem${balance < item.cost ? ' disabled' : ''}>Einlösen</button>
    </div>
  </article>`;
}

function historyText(item) {
  if (item.event_type === 'reward_redeem') return item.note || 'Belohnung eingelöst';
  if (item.event_type === 'adjustment') return item.note || 'Anpassung';
  if (item.event_type === 'sleep_checkin') return item.note || 'Morgen-Check-in';
  return item.note || 'Routine erledigt';
}

export async function mountCoinDex(container, { userId, signal, mountChrome }) {
  const color = categoryColor('coins');
  container.innerHTML = `<div class="wrap pad-bottom coin-dex-seite"><div class="seitenkopf"><h1>COIN-DEX</h1></div><div class="coin-dex-inhalt"><div class="daten-laden">MUSCLE-COINS werden geladen …</div></div></div>`;
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  mountChrome(container, 'coins', 'COIN-DEX', { color, meta: 'Belohnungen', hideAppearanceIcon: true, onPlus: () => rewardEditor({ userId, onSaved: refresh }) });
  let ledgerQuery = supabase.from('muscle_coin_ledger').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
  let rewardsQuery = supabase.from('muscle_rewards').select('*').eq('user_id', userId).eq('active', true).order('cost');
  if (signal) { ledgerQuery = ledgerQuery.abortSignal(signal); rewardsQuery = rewardsQuery.abortSignal(signal); }
  const [{ data: ledger, error }, { data: rewards, error: rewardsError }] = await Promise.all([ledgerQuery, rewardsQuery]);
  if (error || rewardsError) {
    container.querySelector('.coin-dex-inhalt').innerHTML = '<div class="tuck-leer"><b>COIN-DEX noch nicht bereit</b><span>Bitte zuerst das neue Datenbank-Update einspielen.</span></div>';
    return;
  }
  const balance = (ledger || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const next = nextReward(rewards || [], balance);
  const progress = next ? Math.min(100, Math.round((balance / next.cost) * 100)) : 0;
  container.querySelector('.coin-dex-inhalt').innerHTML = `
    <section class="coin-balance-card">
      ${muscleCoinMarkup('coin-balance-symbol')}
      <span><small>DEIN KONTOSTAND</small><strong>${balance}</strong><b>MUSCLE-COINS</b></span>
    </section>
    ${coinEarningOverview()}
    ${next ? `<section class="coin-next"><span><b>Nächste Belohnung</b><small>${escapeHtml(next.name)} · ${next.cost} Coins</small></span><strong>${Math.max(0, next.cost - balance)} fehlen</strong><div class="coin-progress"><i style="width:${progress}%"></i></div></section>` : ''}
    <header class="coin-section-title"><h2>Deine Belohnungen</h2></header>
    <section class="coin-reward-list">${(rewards || []).length ? rewards.map((item) => rewardMarkup(item, balance)).join('') : '<div class="coin-empty"><b>Noch keine Belohnung</b><span>Lege etwas fest, auf das du dich wirklich freust.</span></div>'}</section>
    ${(ledger || []).length ? `<h2 class="coin-history-title">Zuletzt</h2><section class="coin-history">${ledger.slice(0, 8).map((item) => `<div><span>${escapeHtml(historyText(item))}<small>${new Date(item.created_at).toLocaleDateString('de-DE')}</small></span><b class="${item.amount > 0 ? 'plus' : 'minus'}">${item.amount > 0 ? '+' : ''}${item.amount}</b></div>`).join('')}</section>` : ''}`;
  container.querySelector('.coin-reward-list').onclick = async (event) => {
    const card = event.target.closest('[data-reward-id]');
    if (!card) return;
    const reward = (rewards || []).find((item) => item.id === card.dataset.rewardId);
    if (!reward) return;
    if (event.target.closest('[data-reward-edit]')) return rewardEditor({ userId, existing: reward, onSaved: refresh });
    if (!event.target.closest('[data-reward-redeem]')) return;
    if (!confirm(`„${reward.name}“ für ${reward.cost} MUSCLE-COINS einlösen?`)) return;
    const { error: redeemError } = await supabase.rpc('redeem_muscle_reward', { target_reward: reward.id });
    if (redeemError) return toast(redeemError.message || 'Einlösen fehlgeschlagen.');
    notifyCoinBalanceChanged();
    toast('Belohnung eingelöst'); refresh();
  };
}
