import {Component, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {Location} from '@angular/common';
import {MatButton} from '@angular/material/button';

@Component({
  selector: 'app-molecular-system',
  templateUrl: './molecular-system.component.html',
  styleUrls: ['./molecular-system.component.css'],
  standalone: true,
  imports: [MatButton]
})
export class MolecularSystemComponent implements OnInit {

  constructor(private titleService: Title,
              private location: Location) {
  }

  ngOnInit() {
    this.titleService.setTitle('Help: Chemical component, Molecular Entity, and Molecular assembly');
  }

  goBack(): void {
    this.location.back();
  }

}
