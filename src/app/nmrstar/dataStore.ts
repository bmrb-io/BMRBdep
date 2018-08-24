import {FormControl} from '@angular/forms';
import {Loop} from './loop';

export class DataFile {
  dropdownList;
  selectedItems;
  fileName;
  percent;
  control: FormControl;

  constructor(fileName: string, dropdownList: {}, selectedItems: {} = []) {
    this.fileName = fileName;
    this.dropdownList = dropdownList;
    this.selectedItems = selectedItems;
    this.percent = 0;
    this.control = new FormControl(selectedItems);
  }

  getCategories(): Array<string> {
    return this.control.value;
  }
}

export class DataFileStore {
  dataFiles: DataFile[];
  dataFileMap: {};
  dropdownList;

  constructor(fileNames: string[], dropdownList) {
    // Create the dataFiles objects
    this.dataFiles = [];
    this.dataFileMap = {};
    this.dropdownList = dropdownList;
    for (let i = 0; i < fileNames.length; i++) {
      this.addFile(fileNames[i]).percent = 100;
    }
  }

  addFile(filename: string = null, selected: {} = []): DataFile {
    // File already exists
    if (this.dataFileMap[filename]) {
      // Move it to the end of the file list
      const dataFile = this.dataFileMap[filename];
      this.dataFiles.splice(this.dataFiles.indexOf(dataFile), 1);
      this.dataFiles.push(dataFile);

      return dataFile;
    } else {
      const dataFile = new DataFile(filename, this.dropdownList, selected);
      this.dataFiles.push(dataFile);
      this.dataFileMap[filename] = dataFile;
      return dataFile;
    }
  }

  updateName(dataFile: DataFile, fileName: string) {

    // No change, do nothing
    if (dataFile.fileName === fileName) {
      return;
    }

    // Update name
    const oldRecord = this.dataFileMap[dataFile.fileName];
    delete this.dataFileMap[dataFile.fileName];
    dataFile.fileName = fileName;

    // Check if the new filename was already there...
    if (this.dataFileMap[fileName]) {
      // Remove the old file element from the array
      const index = this.dataFiles.indexOf(this.dataFileMap[fileName]);
      if (index > -1) { this.dataFiles.splice(index, 1); }
      // Update the reference to point to the new file upload
      this.dataFileMap[dataFile.fileName] = dataFile;

    // Name change, but same file
    } else {
      this.dataFileMap[fileName] = dataFile;

      // Remove the old file element from the array
      const index = this.dataFiles.indexOf(oldRecord);
      this.dataFiles[index] = dataFile;
    }
  }

  toJSON(): {} {
    const filenames: string[] = [];
    for (let i = 0; i < this.dataFiles.length; i++){
      filenames.push(this.dataFiles[i].fileName);
    }
    return filenames;
  }
}

