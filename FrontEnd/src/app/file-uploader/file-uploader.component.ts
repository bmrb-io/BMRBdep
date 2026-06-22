import {Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DepositionPersistenceService, UploadItem} from '../deposition-persistence.service';
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
  private persistence = inject(DepositionPersistenceService);
  private messagesService = inject(MessagesService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);


  @Input() entry!: Entry;
  @ViewChild('inputFile') fileUploadElement!: ElementRef;
  serverURL: string | null = null;
  showCategoryLink: boolean;
  uploadSubscriptionDict$: Record<string, Subscription>;
  subscription$!: Subscription;
  private dialogRef: MatDialogRef<ConfirmationDialogComponent> | null = null;

  constructor() {
    this.showCategoryLink = true;
    this.uploadSubscriptionDict$ = {};
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

    this.subscription$.add(this.persistence.entrySubject.subscribe({
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
    this.persistence.storeEntry(true);
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

    // Grab the FileSystemEntry roots synchronously — the DataTransferItemList is
    // only valid for the duration of the drop event handler.
    const roots: FileSystemEntry[] = [];
    for (const dtItem of Array.from(dataTransfer.items)) {
      let entry: FileSystemEntry | null = null;
      try {
        entry = dtItem.webkitGetAsEntry();
      } catch {
        try {
          const legacy = dtItem as DataTransferItem & { getAsEntry?(): FileSystemEntry };
          entry = legacy.getAsEntry?.() ?? null;
        } catch {
          console.error('In theory, this error state is impossible.');
        }
      }
      if (entry) {
        roots.push(entry);
      }
    }

    // Walk the whole tree, then upload everything in a single request.
    Promise.all(roots.map(entry => this.collectFileTree(entry, '')))
      .then(nested => this.uploadBatch(nested.flat()));
  }

  private collectFileTree(item: FileSystemEntry, path: string): Promise<UploadItem[]> {
    // Recursively walk a dropped File/Directory tree, resolving to the full list of
    // files found (each with its folder-relative path). The FileSystemEntry APIs are
    // async-callback based, so we promisify them and accumulate rather than uploading
    // in place — that lets the caller send the entire folder as one request.

    if (item.isFile) {
      return new Promise<UploadItem[]>(resolve => {
        (item as FileSystemFileEntry).file(
          (file: File) => {
            // Don't upload hidden files, this will just confuse the user
            resolve(file.name.startsWith('.') ? [] : [{file, path: path + file.name}]);
          },
          () => resolve([]));
      });
    } else if (item.isDirectory) {
      const dirReader = (item as FileSystemDirectoryEntry).createReader();
      const dirPath = path + item.name + '/';

      // readEntries() returns the directory in batches (~100 entries), so it must be
      // called repeatedly until it yields an empty array or large folders lose files.
      const readAllEntries = (): Promise<FileSystemEntry[]> => new Promise(resolve => {
        const all: FileSystemEntry[] = [];
        const readBatch = () => {
          dirReader.readEntries(
            (entries: FileSystemEntry[]) => {
              if (entries.length === 0) {
                resolve(all);
              } else {
                all.push(...entries);
                readBatch();
              }
            },
            () => resolve(all));
        };
        readBatch();
      });

      return readAllEntries()
        .then(entries => Promise.all(entries.map(entry => this.collectFileTree(entry, dirPath))))
        .then(nested => nested.flat());
    }
    return Promise.resolve([]);
  }

  uploadFiles(files: FileList) {
    const items: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.size) {
        this.messagesService.sendMessage(new Message(`It appears that you attempted to upload one or more folders or zero byte
        files. At the current time, uploading folders is only supported on modern browsers, and only via "drag and drop". Please either use
        a newer browser and drag and drop your folder(s), or tar or zip up your directory and then upload it. Uploading multiple files is
        supported in all browsers.`,
          MessageType.NotificationMessage));
        continue;
      }
      items.push({file, path: file.webkitRelativePath || file.name});
    }
    this.uploadBatch(items);
  }

  private uploadBatch(items: UploadItem[]) {
    // Upload an entire set of files (e.g. a dropped folder) as one request so the
    // backend performs a single git commit rather than one per file.
    if (items.length === 0) {
      return;
    }

    // Register every file in the data store up front so the UI shows a row per file.
    const dataFiles = items.map(item => this.entry.dataStore.addFile(item.path));

    const subscription = this.persistence.uploadFile(items).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total) {
            // A single request reports aggregate progress; show it on every row.
            const percent = Math.round(100 * event.loaded / event.total);
            for (const dataFile of dataFiles) {
              dataFile.percent = percent;
            }
          }
        } else if (event instanceof HttpResponse && event.body) {
          this.entry.addCommit(event.body.commit);
          for (let i = 0; i < dataFiles.length; i++) {
            dataFiles[i].percent = 100;
            // The server may have sanitized the name; adopt whatever it stored.
            if (event.body.filenames[i]) {
              this.entry.dataStore.updateName(dataFiles[i], event.body.filenames[i]);
            }
          }
          if (!event.body.changed) {
            this.messagesService.sendMessage(new Message(
              `The ${items.length === 1 ? 'file was' : 'files were'} already present on the server with the same contents.`,
              MessageType.NotificationMessage));
          }
        }
      },
      error: () => {
        for (const dataFile of dataFiles) {
          this.entry.dataStore.deleteFile(dataFile.fileName);
        }
        this.messagesService.sendMessage(new Message(
          `Failed to upload ${items.length === 1 ? 'the file' : 'the files'}, please retry.`,
          MessageType.ErrorMessage, 15000));
      },
      complete: () => {
        this.updateAndSaveDataFiles();
      }
    });

    // Share the subscription under each file's name so a delete can cancel the
    // in-flight upload (cancelling aborts the whole batch, since it is one request).
    for (const item of items) {
      this.uploadSubscriptionDict$[item.path] = subscription;
    }
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
            this.persistence.deleteFile(fileName, true);
          } else {
            this.persistence.deleteFile(fileName);
          }
        }
        this.dialogRef = null;
      }
    });
  }
}
