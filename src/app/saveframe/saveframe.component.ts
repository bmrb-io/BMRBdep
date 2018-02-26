import { ApiService } from '../api.service';
import { Component, OnInit, Input } from '@angular/core';
import { Saveframe, SaveframeTag } from '../nmrstar/saveframe';
import { Schema } from '../nmrstar/schema';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.css']
})
export class SaveframeComponent implements OnInit {
  @Input() saveframe: Saveframe;
  @Input() showall: false;
  schema: Schema;

  constructor(public api: ApiService) {
    this.schema = new Schema('', [], [], {});
  }

  ngOnInit() {
    this.api.getSchema().subscribe(s => {
      this.schema = s;
      this.saveframe.validateTags(this.schema);
      console.log(this.schema);
    });

  }

  tv(tag: SaveframeTag, query: string) {
    return this.schema.getValue(this.saveframe.tag_prefix + '.' + tag.name, query);
  }

  tag(tag: SaveframeTag) {
    return this.schema.getTag(this.saveframe.tag_prefix + '.' + tag.name);
  }

  validateTag(tag: SaveframeTag, tag_value: string) {
    tag.validateTag(this.saveframe.tag_prefix, this.schema);
  }

  dothing(ob) {
    // console.log(ob, this.tag(ob));
  }
}
