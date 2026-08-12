export function isAbortError(error) {
  return error?.name === 'AbortError'
    || /abort(?:ed)?/i.test(String(error?.message || ''));
}

export function isSessionError(error) {
  const value = `${error?.message || ''} ${error?.code || ''}`.toLowerCase();
  return value.includes('jwt')
    || value.includes('refresh token')
    || value.includes('invalid claim')
    || value.includes('not authenticated')
    || value.includes('auth session missing');
}

export function userFacingLoadError(error, { online = true } = {}) {
  if (!online) return {
    title: 'Keine Verbindung',
    message: 'Diese Seite benötigt gerade eine Internetverbindung. Bereits geöffnete Inhalte bleiben weiterhin verfügbar.',
    kind: 'offline',
  };
  if (isSessionError(error)) return {
    title: 'Anmeldung abgelaufen',
    message: 'Deine Sitzung konnte nicht erneuert werden. Bitte melde dich erneut an.',
    kind: 'session',
  };
  return {
    title: 'Seite konnte nicht geladen werden',
    message: 'Deine Daten wurden nicht verändert. Versuche es gleich noch einmal.',
    kind: 'unknown',
  };
}
