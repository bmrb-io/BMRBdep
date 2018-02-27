import { ApiService } from '../api.service';
import { Component, OnInit, Input } from '@angular/core';
import { Saveframe, SaveframeTag } from '../nmrstar/saveframe';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;

  constructor(public api: ApiService) {
  }

  ngOnInit() {
    this.saveframe.validateTags(this.saveframe.parent.schema);
  }

  tv(tag: SaveframeTag, query: string) {
    if (this.saveframe.parent && this.saveframe.parent.schema && tag) {
      return this.saveframe.parent.schema.getValue(this.saveframe.tag_prefix + '.' + tag.name, query);
    }
  }

  tag(tag: SaveframeTag) {
    return this.saveframe.parent.schema.getTag(this.saveframe.tag_prefix + '.' + tag.name);
  }

  validateTag(tag: SaveframeTag, tag_value: string) {
    tag.validateTag(this.saveframe.tag_prefix, this.saveframe.parent.schema);
  }

  dothing(ob) {
    // console.log(ob, this.tag(ob));
  }
}
