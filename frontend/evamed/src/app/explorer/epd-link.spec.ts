import { resumenDescripcion, separarEnlaceEpd } from './epd-link';

describe('EPD link in descriptions (audit A-36)', () => {
  it('takes the ECO Platform address out of the text', () => {
    expect(separarEnlaceEpd('Concreto premezclado.\nEPD: https://portal.eco-platform.org/epds/abc-123'))
      .toEqual({ texto: 'Concreto premezclado.', url: 'https://portal.eco-platform.org/epds/abc-123' });
  });

  it('leaves other texts and other sites alone', () => {
    expect(separarEnlaceEpd('Adobe brick.')).toEqual({ texto: 'Adobe brick.', url: null });
    expect(separarEnlaceEpd('Ver https://evil.example/x')).toEqual({ texto: 'Ver https://evil.example/x', url: null });
    expect(separarEnlaceEpd(null)).toEqual({ texto: '', url: null });
  });

  it('keeps table rows to the first paragraph, shortened', () => {
    expect(resumenDescripcion('Primer párrafo.\n\nSegundo párrafo largo.\nEPD: https://portal.eco-platform.org/epds/x')).toBe('Primer párrafo.');
    expect(resumenDescripcion('a'.repeat(200)).length).toBe(160);
  });
});
