import {UntypedFormControl} from '@angular/forms';
import {FileUploadType} from './schemaTypes';

export class DataFile {
  dropDownList: FileUploadType[];
  selectedItems: unknown;
  fileName: string;
  percent: number;
  control: UntypedFormControl;

  constructor(fileName: string, dropDownList: FileUploadType[], selectedItems: unknown = []) {
    this.fileName = fileName;
    this.dropDownList = dropDownList;
    this.selectedItems = selectedItems;
    this.percent = 0;
    this.control = new UntypedFormControl(selectedItems);
  }
}

export class DataFileStore {
  dataFiles: DataFile[];
  dataFileMap: { [filename: string]: DataFile };
  dropDownList: FileUploadType[];

  constructor(fileNames: string[], dropDownList: FileUploadType[]) {
    // Create the dataFiles objects
    this.dataFiles = [];
    this.dataFileMap = {};
    this.dropDownList = dropDownList;
    for (const fileName of fileNames) {
      this.addFile(fileName).percent = 100;
    }
  }

  addFile(filename: string, selected: unknown = []): DataFile {

    let dataFile: DataFile;

    // File already exists
    if (this.dataFileMap[filename]) {
      // Move it to the end of the file list
      dataFile = this.dataFileMap[filename];
      this.dataFiles.splice(this.dataFiles.indexOf(dataFile), 1);
      this.dataFiles.push(dataFile);

    } else {
      dataFile = new DataFile(filename, this.dropDownList, selected);
      this.dataFiles.push(dataFile);
      this.dataFileMap[filename] = dataFile;
    }
    return dataFile;
  }

  deleteFile(filename: string): boolean {
    if (this.dataFileMap[filename]) {
      const deleteFile = this.dataFileMap[filename];
      delete this.dataFileMap[filename];
      this.dataFiles.splice(this.dataFiles.indexOf(deleteFile), 1);
      return true;
    } else {
      return false;
    }
  }

  updateName(dataFile: DataFile, fileName: string): void {

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
      if (index > -1) {
        this.dataFiles.splice(index, 1);
      }
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

  getDataFileNamesByCategory(category: string): Set<[string, string]> {
    const results = new Set<[string, string]>();
    for (const dataFile of this.dataFiles) {
      for (const value of dataFile.control.value) {
        for (const specificCategory of value[1]) {
          if (specificCategory === category) {
            results.add([dataFile.fileName, dataFile.fileName]);
          }
        }
      }
    }
    return results;
  }

  toJSON(): string[] {
    const filenames: string[] = [];
    for (const dataFile of this.dataFiles) {
      filenames.push(dataFile.fileName);
    }
    return filenames;
  }
}
