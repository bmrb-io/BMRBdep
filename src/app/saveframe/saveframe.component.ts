import { ApiService } from '../api.service';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Saveframe } from '../nmrstar/saveframe';
import { SaveframeTag } from '../nmrstar/tag';
import { SaveframeEditorComponent } from '../saveframe-editor/saveframe-editor.component';
import { ActivatedRoute, Params } from '@angular/router';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;
  @Output() sfReload = new EventEmitter<string>();
  active_tag: SaveframeTag;
  show_category_link: boolean;

  constructor(public api: ApiService, private route: ActivatedRoute) {
    this.active_tag = null;
    this.show_category_link = false;
  }

  ngOnInit() {
    this.route.params.subscribe((params: Params) => {
        this.show_category_link = params['saveframe_description'] !== this.saveframe.category;
      });
  }

  /* A saveframe-level change has happened. Save the changes and
     tell the parent view to refresh */
  processChange() {
    this.saveframe.parent.refresh();
    this.sfReload.emit('reload');
    this.api.saveLocal();
  }

}
