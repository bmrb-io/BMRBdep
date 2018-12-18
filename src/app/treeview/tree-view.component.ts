import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.component.html',
  styleUrls: ['./tree-view.component.css']
})
export class TreeViewComponent implements OnInit {
  active: string;
  @Input() showInvalidOnly: boolean;

  constructor(public api: ApiService,
              private router: Router,
              private route: ActivatedRoute) {
  }

  // TODO: Get review to work by getting showInvalidOnly from URL

  ngOnInit() {

    const parent = this;
    this.router.events.subscribe(() => {
      let r = this.route;
      while (r.firstChild) {
        r = r.firstChild;
      }
      r.params.subscribe(params => {
        if (params['saveframe_description'] !== undefined) {
          parent.active = params['saveframe_description'];
        }
        parent.showInvalidOnly = this.router.url.endsWith('/review');
      });
    });


  }

}
