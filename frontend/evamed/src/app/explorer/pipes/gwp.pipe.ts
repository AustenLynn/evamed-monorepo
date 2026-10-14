import { Pipe, PipeTransform } from '@angular/core';

const SUPERSCRIPT: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  },
  FORMAT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 });

/**
 * Impact values for people: up to 3 decimals, values under 0.001 in powers
 * of ten, and a true minus sign (HANDOFF §7.3).
 */
@Pipe({ name: 'gwp', standalone: false })
export class GwpPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    const magnitude = Math.abs(value);
    let text: string;
    if (magnitude !== 0 && magnitude < 0.001) {
      const [mantissa, exponent] = magnitude.toExponential(2).split('e'),
        power = String(Number(exponent)).replace(/./g, char => SUPERSCRIPT[char]);
      text = `${Number(mantissa)} × 10${power}`;
    } else {
      text = FORMAT.format(magnitude);
    }
    return value < 0 ? `−${text}` : text;
  }
}
