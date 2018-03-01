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
  @Output() myEvent = new EventEmitter<string>();
  active_tag: SaveframeTag;

  constructor(public api: ApiService) {
    this.active_tag = null;
  }

  ngOnInit() {
    this.saveframe.updateTags();
  }

  tag(tag: SaveframeTag) {
    return this.saveframe.parent.schema.getTag(this.saveframe.tag_prefix + '.' + tag.name);
  }

  /* A saveframe-level change has happened. Save the changes and
     tell the parent view to refresh */
  processChange() {
    this.api.saveLocal();
    this.myEvent.emit('reload');
  }

  validateTag(tag: SaveframeTag, tag_value: string) {
    tag.updateTagStatus(this.saveframe.tag_prefix);
    this.api.saveLocal();
  }

}
