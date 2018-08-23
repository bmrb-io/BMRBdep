import {Component, Input, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Saveframe} from '../nmrstar/saveframe';
import {HttpEventType, HttpResponse} from '@angular/common/http';
import {MatProgressBarModule} from '@angular/material/progress-bar';

class DataFile {
  dropdownList;
  selectedItems;
  fileName;
  percent;
  dropdownSettings = {
    singleSelection: false,
    idField: 1,
    textField: 0,
    selectAllText: 'Select All',
    unSelectAllText: 'UnSelect All',
    allowSearchFilter: true,
    enableCheckAll: false,
  };

  constructor(fileName: string, dropdownList: {}, selectedItems: {} = []) {
    this.fileName = fileName;
    this.dropdownList = dropdownList;
    this.selectedItems = selectedItems;
    this.percent = 0;
  }

  updateDropdown(dropdownList) {
    this.dropdownList = dropdownList;
  }
}

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.css']
})
export class FileUploaderComponent implements OnInit {

  @Input() saveframe: Saveframe;
  dataFiles: Array<DataFile>;

  constructor(public api: ApiService) { }

  ngOnInit() {
    this.dataFiles = [new DataFile(null, this.saveframe.parent.schema.file_upload_types)];
  }

  addFile() {
    this.dataFiles.push(new DataFile(null, this.saveframe.parent.schema.file_upload_types));
  }

  onItemSelect (item: any, dataFile: DataFile) {
    console.log(item);
  }
  onSelectAll (items: any, dataFile: DataFile) {
    console.log(items);
  }

  // At the drag drop area
  // (drop)="onDropFile($event)"
  onDropFile(event: DragEvent, dataFile: DataFile) {
    event.preventDefault();
    this.uploadFile(event.dataTransfer.files, dataFile);
  }

  // At the drag drop area
  // (dragover)="onDragOverFile($event)"
  onDragOverFile(event, dataFile: DataFile) {
    event.stopPropagation();
    event.preventDefault();
  }

  // At the file input element
  // (change)="selectFile($event)"
  selectFile(event, dataFile) {
    this.addFile();
    this.uploadFile(event.target.files, dataFile);
  }

  uploadFile(files: FileList, dataFile: DataFile) {
    if (files.length === 0) {
      console.error('No file selected!');
      return;
    }
    //this.api.uploadFile(files[0]);

    dataFile.fileName = files[0].name;
    this.api.uploadFile(files[0])
      .subscribe(
        event => {
          if (event.type === HttpEventType.UploadProgress) {
            dataFile.percent = Math.round(100 * event.loaded / event.total);
          } else if (event instanceof HttpResponse) {
            dataFile.percent = 100;
            dataFile.fileName = event.body['filename'];
          }
        },
        error => {
          this.api.handleError(error);
        }
      );
  }

}
