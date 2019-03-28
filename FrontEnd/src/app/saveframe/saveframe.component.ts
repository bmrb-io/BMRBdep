import {ApiService} from '../api.service';
import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {Saveframe} from '../nmrstar/saveframe';
import {SaveframeTag} from '../nmrstar/tag';
import {ActivatedRoute, Params} from '@angular/router';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SaveframeComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showInvalidOnly: false;
  @Output() sfReload = new EventEmitter<string>();
  activeTag: SaveframeTag;
  showCategoryLink: boolean;

  constructor(public api: ApiService, private route: ActivatedRoute) {
    this.activeTag = null;
    this.showCategoryLink = false;
  }

  ngOnInit() {
    this.route.params.subscribe((params: Params) => {
      this.showCategoryLink = (!('saveframe_category' in params));
      });
  }

  /* A saveframe-level change has happened. Save the changes and
     tell the parent view to refresh */
  processChange(): void {
    const nextCategory = this.saveframe.nextCategory;
    this.saveframe.parent.refresh();
    this.sfReload.emit(nextCategory);
    this.api.saveEntry();
  }

}
