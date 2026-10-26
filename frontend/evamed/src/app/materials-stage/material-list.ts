import { KeyValue } from '@angular/common';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** A system's materials A→Z by the name shown, ignoring case and accents; numbered in that order. */
export const sortByName = <T extends Record<string, any>>(rows: T[], name: (row: T) => unknown): T[] => {
  rows.sort((a, b) => collator.compare(String(name(a) ?? ''), String(name(b) ?? '')));
  rows.forEach((row, index) => ((row as Record<string, unknown>)['key'] = index + 1));
  return rows;
};

/** For `keyvalue` over an array: index order, not the pipe's text order (1, 10, 11, 2…). */
export const byIndex = (a: KeyValue<string, unknown>, b: KeyValue<string, unknown>): number =>
  Number(a.key) - Number(b.key);

/** How long newly added materials stay highlighted in the list. */
export const RECENT_MS = 4000;
