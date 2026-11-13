import {Component, inject, OnDestroy, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {Entry} from '../nmrstar/entry';
import {Subscription} from 'rxjs';
import {SaveframeComponent} from '../saveframe/saveframe.component';

@Component({
  selector: 'app-restore',
  templateUrl: './restore.component.html',
  styleUrls: ['./restore.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [SaveframeComponent]
})
export class RestoreComponent implements OnInit, OnDestroy {
  persistence = inject(DepositionPersistenceService);


  entry: Entry | null = null;
  subscription$!: Subscription;

  ngOnInit() {
    this.subscription$ = this.persistence.entrySubject.subscribe({
      next: entry => this.entry = entry
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }

}
