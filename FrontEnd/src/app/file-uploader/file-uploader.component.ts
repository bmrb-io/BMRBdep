import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Entry} from '../nmrstar/entry';
import {environment} from '../../environments/environment';
import {ActivatedRoute, Params} from '@angular/router';
import {Subscription} from 'rxjs';

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

  constructor(private api: ApiService,
              private messagesService: MessagesService,
              private route: ActivatedRoute) {
    this.showCategoryLink = true;
    this.uploadSubscriptionDict$ = {};
  }

  ngOnInit() {
    this.serverURL = environment.serverURL;
    this.subscription$ = this.route.params.subscribe((params: Params) => {
      if (params['load_type'] === 'category' && params['saveframe_description'] === 'deposited_data_files') {
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
    this.api.saveEntry(false, true);
  }

  // At the drag drop area
  // (drop)="onDropFile($event)"
  onDropFile(event: DragEvent) {
    event.preventDefault();
    if (this.entry && !this.entry.deposited) {
      this.uploadFile(event.dataTransfer.files);
    }
  }

  // At the drag drop area
  // (dragover)="onDragOverFile($event)"
  onDragOverFile(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // At the file input element
  // (change)="selectFile($event)"
  selectFile(event) {
    this.uploadFile(event.target.files);
    this.fileUploadElement.nativeElement.value = '';
  }

  logFileUploadSaveframe() {
    console.log(this.entry.getLoopsByCategory('_Upload_data')[0]);
  }

  uploadFile(files: FileList) {

    let closure = files.length;

    for (let i = 0; i < files.length; i++) {
      const dataFile = this.entry.dataStore.addFile(files[i].name);

      this.uploadSubscriptionDict$[files[i].name] = this.api.uploadFile(files[i])
        .subscribe(
          event => {
            if (event.type === HttpEventType.UploadProgress) {
              dataFile.percent = Math.round(100 * event.loaded / event.total);
            } else if (event instanceof HttpResponse) {
              this.entry.commit = event.body['commit'];
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
            this.messagesService.sendMessage(new Message('Failed to upload file. Do you have an internet connection?',
              MessageType.ErrorMessage, 15000));
          },
          () => {
            closure -= 1;
            if (closure === 0) {
              this.updateAndSaveDataFiles();
            }
          }
        );
    }
  }

  deleteFile(fileName: string): void {
    if (fileName in this.uploadSubscriptionDict$) {
      this.messagesService.sendMessage(new Message('Cancelling upload...', MessageType.NotificationMessage,
        15000));
      this.uploadSubscriptionDict$[fileName].unsubscribe();
      this.api.deleteFile(fileName, true);
    } else {
      this.api.deleteFile(fileName);
    }
  }
}
