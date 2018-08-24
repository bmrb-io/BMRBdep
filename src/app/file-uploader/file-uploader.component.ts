import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Saveframe} from '../nmrstar/saveframe';
import {Message, MessageType} from '../messages.service';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.css']
})
export class FileUploaderComponent implements OnInit {

  @Input() saveframe: Saveframe;
  @ViewChild('inputFile') fileUploadElement: ElementRef;

  constructor(public api: ApiService) { }

  ngOnInit() { }

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
    console.log(event);
    this.uploadFile(event.target.files);
    this.fileUploadElement.nativeElement.value = '';
  }

  uploadFile(files: FileList) {

    for (let i = 0; i < files.length; i++) {
      const dataFile = this.saveframe.parent.dataStore.addFile(files[i].name);

      this.api.uploadFile(files[i])
        .subscribe(
          event => {
            if (event.type === HttpEventType.UploadProgress) {
              dataFile.percent = Math.round(100 * event.loaded / event.total);
            } else if (event instanceof HttpResponse) {
              dataFile.percent = 100;
              this.saveframe.parent.dataStore.updateName(dataFile, event.body['filename']);
              if (!event.body['changed']) {
                this.api.messagesService.sendMessage(new Message(`The file '${event.body['filename']}' was already present on
                the server with the same contents.`, MessageType.NotificationMessage));
              }
            }
          },
          error => {
            this.api.handleError(error);
          }
        );
    }
  }
}
