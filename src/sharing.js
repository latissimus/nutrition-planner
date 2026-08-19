import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function chooseSharedSpace(userId, shares = []) {
  const incoming = shares.find((share) => share.partner_id === userId && share.owner_id);
  return {
    ownerId: incoming?.owner_id || userId,
    isShared: Boolean(incoming),
    shareId: incoming?.id || null,
  };
}

export async function resolveSharedSpace(userId, scope, signal) {
  let query = supabase.from('shared_spaces')
    .select('id,owner_id,partner_id,created_at')
    .eq('scope', scope)
    .eq('partner_id', userId)
    .order('created_at', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return chooseSharedSpace(userId, data || []);
}

export async function openShareSheet(scope) {
  const label = scope === 'shopping' ? 'Einkauf' : 'Food-Dex';
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop teilen-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet teilen-sheet" role="dialog" aria-modal="true" aria-label="${label} teilen">
    <header><h2>${label} teilen</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <p class="profile-hinweis">Die Person benötigt ein eigenes MUSCLE-DEX-Konto. Beide Profile können diesen Bereich anschließend gemeinsam bearbeiten.</p>
    <form data-share-form><label class="dex-entry-field"><span>E-Mail des Partners</span><input class="input" type="email" autocomplete="email" required placeholder="name@beispiel.de"></label><button class="btn btn-primary btn-block" type="submit">Freigeben</button></form>
    <h3>Freigegeben für</h3><div class="teilen-liste" data-share-list><span>Wird geladen …</span></div>
  </section>`;
  const close = () => backdrop.remove();
  backdrop.onclick = (event) => { if (event.target === backdrop || event.target.closest('[data-sheet-close]')) close(); };
  const list = backdrop.querySelector('[data-share-list]');
  const load = async () => {
    const { data, error } = await supabase.rpc('list_owned_space_shares', { space_scope: scope });
    if (error) { list.innerHTML = '<span>Freigaben konnten nicht geladen werden.</span>'; return; }
    list.innerHTML = data?.length ? data.map((share) => `<div><span>${escapeHtml(share.partner_email)}</span><button type="button" data-remove-share="${share.id}" aria-label="Freigabe entfernen">${materialIconMarkup('delete_forever')}</button></div>`).join('') : '<span>Noch mit niemandem geteilt.</span>';
  };
  backdrop.querySelector('[data-share-form]').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const email = event.currentTarget.querySelector('input').value.trim();
    const { error } = await supabase.rpc('share_space_with_email', { space_scope: scope, partner_email: email });
    button.disabled = false;
    if (error) return toast(error.message || 'Freigabe nicht möglich.');
    event.currentTarget.reset(); toast(`${label} freigegeben`); await load();
  };
  list.onclick = async (event) => {
    const button = event.target.closest('[data-remove-share]');
    if (!button) return;
    const { error } = await supabase.from('shared_spaces').delete().eq('id', button.dataset.removeShare);
    if (error) return toast('Freigabe konnte nicht entfernt werden.');
    toast('Freigabe entfernt'); await load();
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
  await load();
}
