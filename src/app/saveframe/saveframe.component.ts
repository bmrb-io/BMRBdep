import { ApiService } from '../api.service';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Saveframe } from '../nmrstar/saveframe';
import { SaveframeTag } from '../nmrstar/tag';
import { SaveframeEditorComponent } from '../saveframe-editor/saveframe-editor.component';

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

  constructor(public api: ApiService) {
    this.active_tag = null;
  }

  ngOnInit() { }

  /* A saveframe-level change has happened. Save the changes and
     tell the parent view to refresh */
  processChange() {
    this.saveframe.parent.refresh();
    this.sfReload.emit('reload');
    this.api.saveLocal();
  }

}
