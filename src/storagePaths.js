const SAFE_SCOPE = /^[a-z0-9-]{1,40}$/;

export function storageScope(value) {
  const scope = String(value || '').trim().toLowerCase();
  return SAFE_SCOPE.test(scope) ? scope : 'home';
}

export function dexStoragePath(userId, rootKey, extension, id = crypto.randomUUID()) {
  const safeExtension = String(extension || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  return `${userId}/${storageScope(rootKey)}/${id}.${safeExtension}`;
}
