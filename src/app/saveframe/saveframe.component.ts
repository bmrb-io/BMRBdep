import {ApiService} from '../api.service';
import {Component, EventEmitter, Input, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {Saveframe} from '../nmrstar/saveframe';
import {SaveframeTag} from '../nmrstar/tag';
import {ActivatedRoute, Params} from '@angular/router';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css'],
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
    this.showCategoryLink = true;
  }

  ngOnInit() {
    this.route.params.subscribe((params: Params) => {
        if (params['load_type'] === 'category') {
          this.showCategoryLink = params['saveframe_description'] !== this.saveframe.category;
        }
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
