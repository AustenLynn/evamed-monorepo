import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'exponential',
    standalone: false
})
export class ExponentialPipe implements PipeTransform {

  transform(value: number): unknown {
    return Math.pow(value, 2);
  }

}
