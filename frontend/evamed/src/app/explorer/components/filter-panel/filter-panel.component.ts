import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ExplorerQuery, Facets } from '../../explorer.models';
import { StageFilter } from '../../stage-config';

export const SEARCH_DEBOUNCE_MS = 300;

interface Option {
  value: string;
  count: number;
  checked: boolean;
}

/** Search first, then the stage's checkbox filters (HANDOFF §4). */
@Component({
  selector: 'app-filter-panel',
  templateUrl: './filter-panel.component.html',
  styleUrls: ['./filter-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FilterPanelComponent implements OnChanges, OnDestroy {
  @Input() filters: StageFilter[] = [];
  @Input() facets: Facets | null = null;
  @Input() query: ExplorerQuery = { search: '', filters: {} };
  @Output() readonly queryChange = new EventEmitter<ExplorerQuery>();

  readonly search = new FormControl('', { nonNullable: true });
  private readonly typing: Subscription;

  constructor() {
    this.typing = this.search.valueChanges
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged())
      .subscribe(search => {
        if (search !== this.query.search) {
          this.queryChange.emit({ ...this.query, search });
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['query'] && this.search.value !== this.query.search) {
      this.search.setValue(this.query.search, { emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    this.typing.unsubscribe();
  }

  get active(): boolean {
    return !!this.query.search || Object.values(this.query.filters).some(values => values.length > 0);
  }

  /** The facet's values, plus any chosen value it no longer counts, so it can be unchecked. */
  options(filter: StageFilter): Option[] {
    const counts = this.facets?.[filter.facet] ?? {},
      chosen = this.query.filters[filter.param] ?? [],
      values = [...Object.keys(counts), ...chosen.filter(value => !(value in counts))];
    return values.map(value => ({ value, count: counts[value] ?? 0, checked: chosen.includes(value) }));
  }

  toggle(filter: StageFilter, value: string, checked: boolean): void {
    const chosen = (this.query.filters[filter.param] ?? []).filter(other => other !== value);
    this.queryChange.emit({
      ...this.query,
      filters: { ...this.query.filters, [filter.param]: checked ? [...chosen, value] : chosen },
    });
  }

  clear(): void {
    this.search.setValue('', { emitEvent: false });
    this.queryChange.emit({ ...this.query, search: '', filters: {} });
  }

  trackOption(_index: number, option: Option): string {
    return option.value;
  }
}
