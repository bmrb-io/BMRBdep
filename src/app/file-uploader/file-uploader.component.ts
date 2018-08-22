import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Saveframe} from '../nmrstar/saveframe';

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.css']
})
export class FileUploaderComponent implements OnInit {

  @Input() saveframe: Saveframe;

  constructor(public api: ApiService) { }

  ngOnInit() {
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
  }

  uploadFile(files: FileList) {
    if (files.length === 0) {
      console.log('No file selected!');
      return;

    }
    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      this.api.uploadFile(file);
    }
  }

}
