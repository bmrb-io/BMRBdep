import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Tag} from '../nmrstar/tag';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.css']
})
export class TagComponent implements OnInit {
  @Input() tag: Tag;
  @Input() unique_identifier: string;

  constructor(public api: ApiService) { }

  ngOnInit() {
  }

  validateTag(tag: Tag): void {
    tag.updateCascade();
    this.api.saveEntry();
  }

}
