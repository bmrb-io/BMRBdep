import { ApiService } from '../api.service';
import { Entry } from '../nmrstar/entry';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe } from '../nmrstar/saveframe';
import { Schema } from '../nmrstar/schema';
import { download } from '../nmrstar/nmrstar';
import { UiSwitchModule } from 'ngx-ui-switch';

@Component({
  selector: 'app-saveframe-editor',
  templateUrl: './saveframe-editor.component.html',
  styleUrls: ['./saveframe-editor.component.css']
})
export class SaveframeEditorComponent implements OnInit {
  saveframes: Saveframe[];
  showall: false;
  entry: string;
  saveframe_description: string;
  load_type: string;
  schema: Schema;

  constructor(private route: ActivatedRoute,
    private api: ApiService) {
    this.saveframes = [new Saveframe('', '', '')];
  }

  ngOnInit() {
    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function(params) {
      parent.load_type = params['load_type'];
      parent.saveframe_description = params['saveframe_description'];
      parent.entry = params['entry'];
      parent.loadSaveframe(params['entry'], params['saveframe_description']);
    });
    this.api.getSchema().subscribe(schem => { this.schema = schem; window.t = schem });
  }

  loadSaveframe(entry: string, saveframe_description: string) {

    const parent = this;
    parent.api.getEntry(entry)
      .subscribe(
        ret_entry => {
          if (this.load_type === 'name') {
            parent.saveframes = [ret_entry.getSaveframeByName(saveframe_description)];
          } else if (this.load_type === 'category') {
            parent.saveframes = ret_entry.getSaveframesByCategory(saveframe_description);
          }
        }
      );
  }

  updateLoopData(event) {
    for (const sf of this.saveframes) {
      for (const loop of sf.loops) {
        loop.checkNull();
      }
    }
  }

  download(name: string, printable_object) {
    download(name, printable_object);
  }

}
