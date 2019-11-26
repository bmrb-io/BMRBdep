import {ApiService} from '../api.service';
import {Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation} from '@angular/core';
import {Saveframe} from '../nmrstar/saveframe';
import {SaveframeTag} from '../nmrstar/tag';
import {ActivatedRoute, Params} from '@angular/router';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-saveframe',
  templateUrl: './saveframe.component.html',
  styleUrls: ['./saveframe.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SaveframeComponent implements OnInit, OnDestroy {
  @Input() saveframe: Saveframe;
  @Output() sfReload = new EventEmitter<string>();
  activeTag: SaveframeTag;
  showCategoryLink: boolean;
  dialogRef: MatDialogRef<ConfirmationDialogComponent>;
  subscription$: Subscription;

  constructor(public api: ApiService,
              private route: ActivatedRoute,
              private dialog: MatDialog) {
    this.activeTag = null;
    this.showCategoryLink = false;
  }

  ngOnInit() {
    this.subscription$ = this.route.params.subscribe((params: Params) => {
      this.showCategoryLink = (!('saveframe_category' in params));
    });
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
  }


  helpClick(activeTag: SaveframeTag, el: HTMLElement) {
    if (this.activeTag !== activeTag) {
      this.activeTag = activeTag;
      setTimeout(() => {el.scrollIntoView(false); }, 1);
    } else {
      this.activeTag = null;
    }
  }

  /* A saveframe-level change has happened. Save the changes and
     tell the parent view to refresh */
  processChange(): void {
    const nextCategory = this.saveframe.nextCategory;
    this.saveframe.parent.refresh();
    this.sfReload.emit(nextCategory);
    this.api.saveEntry();
  }

  deleteSaveframe(): void {

    this.dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: false
    });
    const nameTag: SaveframeTag = this.saveframe.getTag('Name');
    if (nameTag && nameTag.value) {
      this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to delete the section '${nameTag.value}'?` +
        ' You can always restore it later using the "Restore deleted section" panel in the navigation menu.';
    } else {
      this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to delete this section?` +
        ' You can always restore it later using the "Restore deleted section" panel in the navigation menu.';
    }

    this.dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Delete the saveframe
        this.saveframe.delete();
        this.processChange();
      }
      this.dialogRef = null;
    });
  }

  clearSaveframe(): void {

    this.dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: false
    });
    const nameTag: SaveframeTag = this.saveframe.getTag('Name');
    if (nameTag && nameTag.value) {
      this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to clear all data in the section '${nameTag.value}'?` +
        ' There is no way to undo this action later.';
    } else {
      this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to clear all data in this section?` +
        ' There is no way to undo this action later.';
    }
    this.dialogRef.componentInstance.proceedMessage = 'Clear data';

    this.dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Delete the saveframe
        this.saveframe.clear();
        this.processChange();
      }
      this.dialogRef = null;
    });
  }
}
