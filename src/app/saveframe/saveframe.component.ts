import { ApiService } from '../api.service';
import { Component, OnInit, Input } from '@angular/core';
import { Saveframe } from '../nmrstar/saveframe';
import { SaveframeTag } from '../nmrstar/tag';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;
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

  validateTag(tag: SaveframeTag, tag_value: string) {
    tag.updateTagStatus(this.saveframe.tag_prefix);
    this.api.saveLocal();
  }

}
