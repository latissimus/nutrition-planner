import { supabase } from './supabase.js';

const lokaleHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export function authRedirectUrl(locationLike = window.location) {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim();
  if (configured) return `${configured.replace(/\/+$/, '')}/`;
  if (!lokaleHosts.has(locationLike.hostname)) {
    return `${locationLike.origin}${locationLike.pathname}`;
  }
  // Die lokale Adresse ist vom iPhone aus nicht erreichbar. Ohne eigens
  // gesetzte Produktions-URL verwenden Entwicklungsbuilds deshalb dieselbe
  // GitHub-Pages-Adresse wie das Deployment dieses Repositories.
  return 'https://latissimus.github.io/nutrition-planner/';
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || '' } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const redirectTo = authRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function loadProfile(userId) {
  for (let versuch = 0; versuch < 4; versuch++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, avatar_url, zeitzone, falten_intervall_wochen, falten_erinnerung, falten_uhrzeit, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}
