import {Component, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {Location} from '@angular/common';
import {ApiService} from '../api.service';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-molecular-system',
  templateUrl: './molecular-system.component.html',
  styleUrls: ['./molecular-system.component.css']
})
export class MolecularSystemComponent implements OnInit {

  constructor(private titleService: Title,
              private location: Location,
              private api: ApiService,
              private route: ActivatedRoute) {
  }

  ngOnInit() {
    this.titleService.setTitle('Help: Chemical component, Molecular Entity, and Molecular assembly');

    const parent: MolecularSystemComponent = this;
    this.route.params.subscribe(params => parent.api.loadEntry(params['entry']));
  }

  goBack(): void {
    this.location.back();
  }

}
