const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.82;

export function scaledImageSize(width, height, maxEdge = DEFAULT_MAX_EDGE) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(1, maxEdge / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    scaled: scale < 1,
  };
}

/* Dateiendung aus dem tatsaechlichen Inhaltstyp – nie aus dem gewuenschten.
   Rein gehalten, damit der Rueckfall ohne Canvas pruefbar bleibt. */
export function bildEndung(mimeTyp) {
  const unter = String(mimeTyp || '').split('/')[1]?.toLowerCase() || '';
  if (unter === 'jpeg') return 'jpg';
  return /^[a-z0-9]{2,5}$/.test(unter) ? unter : 'jpg';
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Bild konnte nicht verarbeitet werden.')), type, quality);
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close?.(),
    };
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    image.src = objectUrl;
  });
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}

/**
 * Verkleinert große Fotos vor dem Upload. Animierte GIFs und nicht dekodierbare
 * HEIC-Dateien bleiben unverändert, damit kein Inhalt verloren geht.
 */
export async function optimizeImageFile(file, {
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY,
} = {}) {
  if (!file || file.type === 'image/gif' || typeof document === 'undefined') return file;
  let decoded;
  try {
    decoded = await decodeImage(file);
    const target = scaledImageSize(decoded.width, decoded.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(decoded.source, 0, 0, target.width, target.height);
    /* toBlob faellt auf PNG zurueck, wenn das gewuenschte Format nicht
       kodiert werden kann – ohne Rueckmeldung. Genau das ist passiert: eine
       PNG-Datei lag als "bild.webp" mit Content-Type image/webp in der
       Ablage und wog 3,7 MB statt rund 250 KB. Deshalb wird das tatsaechlich
       gelieferte Format ausgewertet und bei Bedarf auf JPEG ausgewichen,
       das jeder Browser kodieren kann. */
    let blob = await canvasBlob(canvas, 'image/webp', quality);
    if (blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', quality);
    const browserFriendlyOriginal = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    // Auch eine verkleinerte Fassung darf nicht groesser sein als das Original.
    if (browserFriendlyOriginal && blob.size >= file.size) return file;
    const baseName = String(file.name || 'bild').replace(/\.[^.]+$/, '') || 'bild';
    const typ = blob.type || 'image/jpeg';
    return new File([blob], `${baseName}.${bildEndung(typ)}`, { type: typ, lastModified: file.lastModified || Date.now() });
  } catch {
    return file;
  } finally {
    decoded?.release?.();
  }
}

export function uploadExtension(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return String(file?.type || '').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
}
