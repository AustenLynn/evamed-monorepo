import { Directive, ElementRef } from '@angular/core';

@Directive({
    selector: '[appHighlight]',
    standalone: false
})
export class HighlightDirective {

  constructor(
    element: ElementRef
  ) {
    element.nativeElement.style.backgroundColor = 'red';
  }

}
