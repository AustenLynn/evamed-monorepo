import { Pipe, PipeTransform } from '@angular/core';

/** Trim insignificant fractional zeros without converting precise API strings. */
@Pipe({name: 'quantityDisplay', standalone: true})
export class QuantityDisplayPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return String(value ?? 0).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  }
}
