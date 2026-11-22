/** ECO Platform descriptions end with "EPD: <portal address>". Only that site becomes a link. */
const EPD = /\s*EPD:\s*(https:\/\/portal\.eco-platform\.org\/\S+)\s*$/;

/** The description without its trailing EPD address, and the address to link (audit A-36). */
export function separarEnlaceEpd(descripcion: string | null | undefined): { texto: string; url: string | null } {
  const texto = descripcion ?? '',
    match = EPD.exec(texto);
  return match ? { texto: texto.slice(0, match.index).trim(), url: match[1] } : { texto, url: null };
}

/** First paragraph of a description, without the EPD address, for one table row. */
export function resumenDescripcion(descripcion: string | null | undefined, max = 160): string {
  const primero = separarEnlaceEpd(descripcion).texto.split(/\n\s*\n|\n/)[0].trim();
  return primero.length > max ? primero.slice(0, max - 1).trimEnd() + '…' : primero;
}
