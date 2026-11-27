import { DOCUMENT } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Inject, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { ExplorerQuery } from '../../../explorer/explorer.models';
import { UsagePickerService } from '../../services/usage-picker.service';
import { UsageOption } from '../../usage.models';

@Component({selector: 'app-usage-source-picker', templateUrl: './usage-source-picker.component.html',
  styleUrls: ['./usage-source-picker.component.scss'], standalone: false})
export class UsageSourcePickerComponent implements AfterViewInit, OnDestroy {
  @Input() options: UsageOption[] = [];
  @Input() selectedKeys: string[] = [];
  @Input() error = '';
  @Input() recoveryEnabled = false;
  @Input() mode: 'add' | 'replace' = 'add';
  @Input() set pending(value: boolean) {
    if (this._pending && !value) this.submitted = false;
    this._pending = value;
  }
  get pending(): boolean {return this._pending;}
  // Public editor contract uses close for the picker dismissal intent.
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() close = new EventEmitter<void>();
  @Output() recover = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<UsageOption[]>();
  @ViewChild('dialog', {static: true}) dialog!: ElementRef<HTMLElement>;
  readonly selected = new Set<string>();
  query: ExplorerQuery = {search: '', filters: {}};
  view = 'cards';
  /** The energy type whose detail sheet is open (2026-11-27); photovoltaic has none. */
  detail: UsageOption | null = null;
  private _pending = false;
  private submitted = false;
  private previousFocus: HTMLElement | null = null;
  constructor(readonly browser: UsagePickerService, @Inject(DOCUMENT) private document: Document) {}
  get locked(): boolean {return this.pending || this.submitted;}
  get available(): UsageOption[] {return this.options.filter(option => option.supported && option.offerable !== false && !this.selectedKeys.includes(option.key));}
  get filtered(): UsageOption[] {return this.available.filter(option => this.browser.matches(option, this.query));}
  get facets() {return this.browser.facets(this.available, this.query);}
  get selection(): UsageOption[] {return this.options.filter(option => this.selected.has(option.key));}
  get selectionItems(): {id: number; name: string}[] {return this.selection.map(option => ({id: option.selectionId, name: option.name}));}
  trackOption(_index: number, option: UsageOption): string {return option.key;}
  open(option: UsageOption): void {
    if (this.locked) return;
    if (option.type === null) {this.pick(option); return;}
    this.detail = option;
  }
  get detailAction(): string {
    if (!this.detail) return '';
    return this.mode === 'replace' ? 'Elegir esta fuente' : this.selected.has(this.detail.key) ? 'Quitar de la selección' : 'Agregar a la selección';
  }
  pick(option: UsageOption): void {
    if (this.locked || !this.available.some(item => item.key === option.key)) return;
    if (this.mode === 'replace') {
      this.submitted = true;
      this.confirm.emit([option]);
      return;
    }
    if (this.selected.has(option.key)) this.selected.delete(option.key); else this.selected.add(option.key);
  }
  removeSelection(id: number): void {
    const option = this.options.find(item => item.selectionId === id);
    if (option) this.pick(option);
  }
  submit(): void {
    if (this.locked || !this.selection.length) return;
    this.submitted = true;
    this.confirm.emit([...this.selection]);
  }
  updateQuery(query: ExplorerQuery): void {if (!this.locked) this.query = query;}
  requestRecovery(): void {if (this.recoveryEnabled) this.recover.emit();}
  requestClose(): void {if (!this.locked) this.close.emit();}
  @HostListener('document:keydown', ['$event']) onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); this.requestClose();}
    if (event.key !== 'Tab') return;
    const controls = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]')).filter(node => !node.hasAttribute('hidden')),
     first = controls[0], last = controls[controls.length - 1];
    if (!first) {event.preventDefault(); this.dialog.nativeElement.focus(); return;}
    if (event.shiftKey && (this.document.activeElement === first || this.document.activeElement === this.dialog.nativeElement)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {event.preventDefault(); first.focus();}
  }
  ngAfterViewInit(): void {
    this.previousFocus = this.document.activeElement as HTMLElement;
    this.dialog.nativeElement.focus();
  }
  ngOnDestroy(): void {if (this.previousFocus?.isConnected) this.previousFocus.focus();}
}
