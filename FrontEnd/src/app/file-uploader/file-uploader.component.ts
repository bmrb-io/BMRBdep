import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Entry} from '../nmrstar/entry';
import {environment} from '../../environments/environment';
import {ActivatedRoute, Params} from '@angular/router';
import {Subscription} from 'rxjs';
import {type} from 'os';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss']
})
export class FileUploaderComponent implements OnInit, OnDestroy {

  @Input() entry: Entry;
  @ViewChild('inputFile') fileUploadElement: ElementRef;
  serverURL: String = null;
  showCategoryLink: boolean;
  uploadSubscriptionDict$: {};
  subscription$: Subscription;
  public activeUploads;

  constructor(private api: ApiService,
              private messagesService: MessagesService,
              private route: ActivatedRoute) {
    this.showCategoryLink = true;
    this.uploadSubscriptionDict$ = {};
    this.activeUploads = 0;
  }

  ngOnInit() {
    this.serverURL = environment.serverURL;
    this.subscription$ = this.route.params.subscribe((params: Params) => {
      if (params['saveframe_category'] === 'deposited_data_files') {
        this.showCategoryLink = false;
      }
    });

    this.subscription$.add(this.api.entrySubject.subscribe(entry => {
      if (entry) {
        for (const file of entry.dataStore.dataFiles) {
          if (entry.deposited) {
            file.control.disable();
          } else {
            file.control.enable();
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
  onDragOverFile(event) {
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
  selectFile(event) {
    this.processUploadEventAndUpload(event);
    this.fileUploadElement.nativeElement.value = '';
  }

  logFileUploadSaveframe() {
    console.log(this.entry.getLoopsByCategory('_Upload_data')[0]);
  }

  processUploadEventAndUpload(event: DragEvent) {
    if (typeof event.dataTransfer.items[0].webkitGetAsEntry !== 'function' &&
      typeof event.dataTransfer.items[0].webkitGetAsEntry !== 'function') {
      console.log('I need fallback, giving up.');
      return;
    }

    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      try {
        this.traverseFileTree(event.dataTransfer.items[i].webkitGetAsEntry(), undefined);
      } catch {
        this.traverseFileTree(event.dataTransfer.items[i].getAsEntry(), undefined);
      }
    }

    //this.uploadFiles(files);
  }


  traverseFileTree(item, path) {
    // This takes a list of File or Directory items, and recursively explores the directories, adding all files
    //  within them for upload.

    let files = [];
    const parent = this;
    path = path || '';

    if (item.isFile) {
      // Get file
      item.file(function (file) {
        console.log('File:', path + file.name, item);
        //files.push([file, path]);
        parent.uploadFile(file, path);
      });
    } else if (item.isDirectory) {
      // Get folder contents
      const dirReader = item.createReader();
      dirReader.readEntries(function (entries) {
        for (let i = 0; i < entries.length; i++) {
          files = files.concat(parent.traverseFileTree(entries[i], path + item.name + '/'));
        }
      });
    }
    return files;
  }

  uploadFile(file, path) {

    const fullName = path + file.name;

    const dataFile = this.entry.dataStore.addFile(fullName);

    this.activeUploads += 1;
    this.uploadSubscriptionDict$[fullName] = this.api.uploadFile(file, path)
      .subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            dataFile.percent = Math.round(100 * event.loaded / event.total);
          } else if (event instanceof HttpResponse) {
            this.entry.addCommit(event.body['commit']);
            dataFile.percent = 100;
            this.entry.dataStore.updateName(dataFile, event.body['filename']);
            if (!event.body['changed']) {
              this.messagesService.sendMessage(new Message(`The file '${event.body['filename']}' was already present on
                the server with the same contents.`, MessageType.NotificationMessage));
            }
          }
        },
        () => {
          this.entry.dataStore.deleteFile(dataFile.fileName);
          this.messagesService.sendMessage(new Message(`Failed to upload file ${dataFile.fileName}, please retry.`,
            MessageType.ErrorMessage, 15000));
          this.activeUploads -= 1;
        },
        () => {
          this.activeUploads -= 1;
          if (this.activeUploads === 0) {
            this.updateAndSaveDataFiles();
          }
        }
      );

  }

  deleteFile(fileName: string): void {
    if (fileName in this.uploadSubscriptionDict$) {
      this.uploadSubscriptionDict$[fileName].unsubscribe();
      this.api.deleteFile(fileName, true);
    } else {
      this.api.deleteFile(fileName);
    }
  }
}
