import {Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Entry} from '../nmrstar/entry';
import {environment} from '../../environments/environment';
import {ActivatedRoute, Params, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {ConfirmationDialogComponent} from '../confirmation-dialog/confirmation-dialog.component';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {MatButton} from '@angular/material/button';
import {MatProgressBar} from '@angular/material/progress-bar';
import {NgClass} from '@angular/common';
import {MatFormField, MatOption, MatSelect} from '@angular/material/select';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
  standalone: true,
  imports: [MatButton, RouterLink, MatProgressBar, NgClass, MatFormField, MatSelect, FormsModule, ReactiveFormsModule, MatOption]
})
export class FileUploaderComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private messagesService = inject(MessagesService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);


  @Input() entry!: Entry;
  @ViewChild('inputFile') fileUploadElement!: ElementRef;
  serverURL: string | null = null;
  showCategoryLink: boolean;
  uploadSubscriptionDict$: Record<string, Subscription>;
  subscription$!: Subscription;
  public activeUploads: number;
  private dialogRef: MatDialogRef<ConfirmationDialogComponent> | null = null;

  constructor() {
    this.showCategoryLink = true;
    this.uploadSubscriptionDict$ = {};
    this.activeUploads = 0;
  }

  ngOnInit() {
    this.serverURL = environment.serverURL;
    this.subscription$ = this.route.params.subscribe({
      next: (params: Params) => {
        if (params['saveframe_category'] === 'deposited_data_files') {
          this.showCategoryLink = false;
        }
      }
    });

    this.subscription$.add(this.api.entrySubject.subscribe({
      next: entry => {
        if (entry) {
          for (const file of entry.dataStore.dataFiles) {
            if (entry.deposited) {
              file.control.disable();
            } else {
              file.control.enable();
            }
          }
        }
      }
    }));
  }

  ngOnDestroy() {
    if (this.subscription$) {
      this.subscription$.unsubscribe();
    }
  }

  openInput() {
    this.fileUploadElement.nativeElement.click();
  }

  updateAndSaveDataFiles() {
    this.entry.updateUploadedData();
    this.entry.refresh();
    this.api.storeEntry(true);
  }

  // At the drag drop area
  // (dragover)="onDragOverFile($event)"
  onDragOverFile(event: DragEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  // At the drag drop area
  // (drop)="onDropFile($event)"
  onDropFile(event: DragEvent) {
    event.preventDefault();
    if (this.entry && !this.entry.deposited) {
      this.processUploadEventAndUpload(event);
    }
  }

  // At the file input element
  // (change)="selectFile($event)"
  selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.uploadFiles(input.files);
    }
    this.fileUploadElement.nativeElement.value = '';
  }

  logFileUploadSaveframe() {
    console.log(this.entry.getLoopsByCategory('_Upload_data')[0]);
  }

  processUploadEventAndUpload(event: DragEvent) {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    const firstItem = dataTransfer.items[0] as (DataTransferItem & { getAsEntry?(): FileSystemEntry }) | undefined;
    if (!firstItem ||
      (typeof firstItem.webkitGetAsEntry !== 'function' &&
        typeof firstItem.getAsEntry !== 'function')) {
      // Fall back to just uploading the top level files
      this.uploadFiles(dataTransfer.files);
      return;
    }

    for (const dtItem of Array.from(dataTransfer.items)) {
      try {
        const entry = dtItem.webkitGetAsEntry();
        if (entry) {
          this.traverseFileTree(entry, '');
        }
      } catch {
        try {
          const legacy = dtItem as DataTransferItem & { getAsEntry?(): FileSystemEntry };
          const entry = legacy.getAsEntry?.();
          if (entry) {
            this.traverseFileTree(entry, '');
          }
        } catch {
          console.error('In theory, this error state is impossible.');
        }
      }
    }
  }


  traverseFileTree(item: FileSystemEntry, path: string): void {
    // Recursively walk a dropped File/Directory tree, uploading each file we encounter.
    // Returns nothing — the FileSystemEntry APIs are async-callback based, so accumulating
    // and returning the file list isn't possible; uploads are kicked off in-place instead.

    const parent = this;
    path = path || '';

    if (item.isFile) {
      // Get file
      (item as FileSystemFileEntry).file(function (file: File) {
        console.log('File:', path + file.name, item);

        // Don't upload hidden files, this will just confuse the user
        if (!file.name.startsWith('.')) {
          parent.uploadFile(file);
        }
      });
    } else if (item.isDirectory) {
      // Get folder contents
      const dirReader = (item as FileSystemDirectoryEntry).createReader();
      dirReader.readEntries(function (entries: FileSystemEntry[]) {
        for (const entry of entries) {
          parent.traverseFileTree(entry, path + item.name + '/');
        }
      });
    }
  }

  uploadFiles(files: FileList) {
    for (const file of Array.from(files)) {
      if (!file.size) {
        this.messagesService.sendMessage(new Message(`It appears that you attempted to upload one or more folders or zero byte
        files. At the current time, uploading folders is only supported on modern browsers, and only via "drag and drop". Please either use
        a newer browser and drag and drop your folder(s), or tar or zip up your directory and then upload it. Uploading multiple files is
        supported in all browsers.`,
          MessageType.NotificationMessage));
        continue;
      }
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {

    const dataFile = this.entry.dataStore.addFile(file.name);

    this.activeUploads += 1;
    this.uploadSubscriptionDict$[file.name] = this.api.uploadFile(file)
      .subscribe({
        next: event => {
          if (event.type === HttpEventType.UploadProgress) {
            if (event.total) {
              dataFile.percent = Math.round(100 * event.loaded / event.total);
            }
          } else if (event instanceof HttpResponse && event.body) {
            this.entry.addCommit(event.body.commit);
            dataFile.percent = 100;
            this.entry.dataStore.updateName(dataFile, event.body.filename);
            if (!event.body.changed) {
              this.messagesService.sendMessage(new Message(`The file '${event.body.filename}' was already present on
                the server with the same contents.`, MessageType.NotificationMessage));
            }
          }
        },
        error: () => {
          this.entry.dataStore.deleteFile(dataFile.fileName);
          this.messagesService.sendMessage(new Message(`Failed to upload file ${dataFile.fileName}, please retry.`,
            MessageType.ErrorMessage, 15000));
          this.activeUploads -= 1;
        },
        complete: () => {
          this.activeUploads -= 1;
          if (this.activeUploads === 0) {
            this.updateAndSaveDataFiles();
          }
        }
      });

  }

  deleteFile(fileName: string): void {

    this.dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      disableClose: false
    });
    this.dialogRef.componentInstance.confirmMessage = `Are you sure you want to delete the file '${fileName}'?`;

    this.dialogRef.afterClosed().subscribe({
      next: result => {
        if (result) {
          if (fileName in this.uploadSubscriptionDict$) {
            this.uploadSubscriptionDict$[fileName].unsubscribe();
            this.api.deleteFile(fileName, true);
          } else {
            this.api.deleteFile(fileName);
          }
        }
        this.dialogRef = null;
      }
    });
  }
}
