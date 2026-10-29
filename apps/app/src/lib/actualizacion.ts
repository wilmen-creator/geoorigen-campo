// Aviso de versión nueva: compara la versión instalada con la última publicada
// en GitHub Releases. Si no hay señal, simplemente no avisa.

const REPO = 'wilmen-creator/geoorigen-campo';
export const ENLACE_DESCARGA = `https://github.com/${REPO}/releases/latest/download/GeoOrigen-Campo.apk`;

function esMayor(a: string, b: string): boolean {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Devuelve la versión nueva disponible (p. ej. "2.0.3") o null */
export async function versionNueva(): Promise<string | null> {
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const ultima = String((await r.json()).tag_name ?? '').replace(/^v/, '');
    return ultima && esMayor(ultima, __VERSION_APP__) ? ultima : null;
  } catch {
    return null;
  }
}
