import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {ApiService} from '../api.service';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {Message, MessagesService, MessageType} from '../messages.service';
import {Entry} from '../nmrstar/entry';
import {environment} from '../../environments/environment';
import {ActivatedRoute, Params} from '@angular/router';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss']
})
export class FileUploaderComponent implements OnInit {

  @Input() entry: Entry;
  @ViewChild('inputFile') fileUploadElement: ElementRef;
  serverURL: String = null;
  showCategoryLink: boolean;

  constructor(private api: ApiService,
              private messagesService: MessagesService,
              private route: ActivatedRoute) {
    this.showCategoryLink = true;
  }

  ngOnInit() {
    this.serverURL = environment.serverURL;
    this.route.params.subscribe((params: Params) => {
      if (params['load_type'] === 'category' && params['saveframe_description'] === 'deposited_data_files') {
        this.showCategoryLink = false;
      }
    });
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

  logFileUploadSaveframe() {
    console.log(this.entry.getLoopsByCategory('_Upload_data')[0]);
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
            this.entry.dataStore.deleteFile(dataFile.fileName);
            this.api.handleError(error);
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
    this.api.deleteFile(fileName);
  }
}
