import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Entry} from '../nmrstar/entry';
import {environment} from '../../environments/environment';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.css']
})
export class FileUploaderComponent implements OnInit {

  @Input() entry: Entry;
  @ViewChild('inputFile') fileUploadElement: ElementRef;
  serverURL: String = null;

  constructor(public api: ApiService,
              private messagesService: MessagesService) {
  }

  ngOnInit() {
    this.serverURL = environment.serverURL;
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
    this.uploadFile(event.dataTransfer.files);
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

  uploadFile(files: FileList) {

    let closure = files.length;

    for (let i = 0; i < files.length; i++) {
      const dataFile = this.entry.dataStore.addFile(files[i].name);

      this.api.uploadFile(files[i])
        .subscribe(
          event => {
            if (event.type === HttpEventType.UploadProgress) {
              dataFile.percent = Math.round(100 * event.loaded / event.total);
            } else if (event instanceof HttpResponse) {
              dataFile.percent = 100;
              this.entry.dataStore.updateName(dataFile, event.body['filename']);
              if (!event.body['changed']) {
                this.messagesService.sendMessage(new Message(`The file '${event.body['filename']}' was already present on
                the server with the same contents.`, MessageType.NotificationMessage));
              }
            }
          },
          error => {
            this.api.handleError(error);
            this.entry.dataStore.deleteFile(dataFile.fileName);
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
    if (this.api.deleteFile(fileName)) {
      this.entry.dataStore.deleteFile(fileName);
      this.updateAndSaveDataFiles();
    }
  }
}
