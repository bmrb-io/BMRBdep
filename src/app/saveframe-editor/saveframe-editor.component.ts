import { ApiService } from '../api.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Saveframe } from '../nmrstar/saveframe';
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

  constructor(private route: ActivatedRoute,
    private api: ApiService) {
    this.saveframes = [new Saveframe('', '', '')];
  }

  ngOnInit() {
    // Refresh the current SF name


    // Listen for the changing of the params string
    const parent = this;
    this.route.params.subscribe(function(params) {
      parent.load_type = params['load_type'];
      parent.saveframe_description = params['saveframe_description'];
      parent.entry = params['entry'];
      parent.loadSaveframe(params['entry'], params['saveframe_description']);
    });
  }

  loadSaveframe(entry: string, saveframe_description: string) {

    const parent = this;

    if (this.load_type === 'name') {
      parent.api.getSaveframeByName(entry, saveframe_description)
        .subscribe(
          sf => {parent.saveframes = [sf]; }
        );
    } else if (this.load_type === 'category') {
      parent.api.getSaveframesByCategory(entry, saveframe_description)
        .subscribe(
          sf => {parent.saveframes = sf; }
        );
    }

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
