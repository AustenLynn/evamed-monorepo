import { GwpPipe } from './gwp.pipe';

describe('GwpPipe', () => {
  const pipe = new GwpPipe();

  it.each([
    [12.3456, '12.346'],
    [3680, '3,680'],
    [0.25, '0.25'],
    [0.001, '0.001'],
    [0, '0'],
    [0.00012, '1.2 × 10⁻⁴'],
    [0.0000123, '1.23 × 10⁻⁵'],
    [-2.5, '−2.5'],
    [-0.0005, '−5 × 10⁻⁴'],
  ])('formats %s as %s', (value, text) => {
    expect(pipe.transform(value)).toBe(text);
  });

  it('shows a dash when there is no value', () => {
    expect(pipe.transform(null)).toBe('—');
  });
});
