import {Observable, ReplaySubject, Subscription} from 'rxjs';
import {Entry, entryFromJSON, EntrySerialized} from './nmrstar/entry';
import {Saveframe} from './nmrstar/saveframe';
import {EntryJSON} from './nmrstar/schemaTypes';
import {inject, Injectable, OnDestroy} from '@angular/core';
import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {NavigationEnd, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {ConfirmationDialogComponent} from './confirmation-dialog/confirmation-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {StorageService} from './storage.service';
import {ApiErrorHandler} from './api-error-handler.service';

interface BroadcastMessage {
  type: 'mutated' | 'loaded' | 'cleared';
  entryID?: string;
}

const BROADCAST_CHANNEL = 'bmrbdep';

export interface FileUploadResponse {
  commit: string;
  filename: string;
  changed: boolean;
}

export interface CommitResponse {
  commit: string;
}

export interface ValidationStatusResponse {
  status: boolean;
  commit: string;
}

export interface SaveEntryReloadResponse {
  error: 'reload';
}

export type SaveEntryResponse = CommitResponse | SaveEntryReloadResponse;

function getTime(): number {
  return (new Date()).getTime();
}

@Injectable({providedIn: 'root'})
export class DepositionPersistenceService implements OnDestroy {
  private http = inject(HttpClient);
  private messagesService = inject(MessagesService);
  private router = inject(Router);
  private titleService = inject(Title);
  private dialog = inject(MatDialog);
  private storage = inject(StorageService);
  private errorHandler = inject(ApiErrorHandler);

  public entrySubject: ReplaySubject<Entry | null>;
  private cachedEntry: Entry | null = null;
  private subscription$!: Subscription;
  private saveTimer!: ReturnType<typeof setInterval>;
  private lastChangeTime: number | null = null;
  private firstSaveMessageSent: boolean = false;
  public saveInProgress: boolean = false;
  private broadcast!: BroadcastChannel;
  private conflictDialogOpen = false;
  // Per-saveframe last-saved JSON snapshots, keyed by Saveframe.uniqueId.
  // Used to compute which saveframes are dirty so incremental save only sends
  // those. Repopulated on load, mutated only on successful save responses.
  private savedSaveframeSnapshots = new Map<string, string>();

  private JSONOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor() {
    this.entrySubject = new ReplaySubject<Entry | null>();
    this.firstSaveMessageSent = false;

    this.subscription$ = this.entrySubject.subscribe({
      next: entry => {
        this.cachedEntry = entry;
        if (entry) {
          this.titleService.setTitle(`BMRBdep: ${entry.depositionNickname}`);
        } else {
          this.titleService.setTitle('BMRBdep');
        }
      }
    });

    this.broadcast = new BroadcastChannel(BROADCAST_CHANNEL);
    this.broadcast.onmessage = ev => this.handleBroadcast(ev.data as BroadcastMessage);

    this.hydrateFromStorage();

    // Used to open verification links in same tab
    window.name = 'BMRBdep';

    this.lastChangeTime = null;
    this.saveInProgress = false;
    this.saveTimer = setInterval(() => {
      // If there is an active entry, that is old enough to need saving
      if (this.cachedEntry && this.cachedEntry.unsaved && this.lastChangeTime !== null && !this.saveInProgress) {
        this.saveEntry();
      }
    }, 5000);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
    clearInterval(this.saveTimer);
    this.broadcast.close();
  }

  get currentEntry(): Entry | null {
    return this.cachedEntry;
  }

  getEntryID(): string | null {
    if (this.cachedEntry === null) {
      return null;
    }
    return this.cachedEntry.entryID;
  }

  private async hydrateFromStorage(): Promise<void> {
    let rawJSON, schema;
    try {
      const [rawEntry, rawSchema] = await Promise.all([this.storage.get('entry'), this.storage.get('schema')]);
      rawJSON = rawEntry ? JSON.parse(rawEntry) : null;
      schema = rawSchema ? JSON.parse(rawSchema) : null;
    } catch {
      console.error('Invalid cached entry!');
      rawJSON = null;
      schema = null;
    }
    if (rawJSON !== null && schema !== null) {
      rawJSON['schema'] = schema;
      const entry = entryFromJSON(rawJSON);
      this.seedSnapshots(entry);
      this.entrySubject.next(entry);
      this.checkLastCommit().then(foundCommit => {
        if (!foundCommit) {
          if (entry.unsaved) {
            this.messagesService.sendMessage(new Message('You have unsaved local changes (perhaps from working offline) but ' +
              'we must reload your entry due to a change to your deposition that occurred on the server. Unfortunately this means ' +
              'that your most recent changes may be lost. Please review your entry in entirety before depositing to make sure that it is ' +
              'up to date.', MessageType.ErrorMessage));
          }
          this.loadEntry(entry.entryID, true);
        } else {
          // The stored entry is unsaved, so save it now!
          if (entry.unsaved) {
            this.saveEntry();
          }
        }
      });
    } else {
      this.subscription$.add(this.router.events.subscribe({
        next: event => {
          if (event instanceof NavigationEnd) {
            if (this.router.url.indexOf('/load/') < 0 && this.router.url.indexOf('/help') < 0 && this.router.url.indexOf('/support') < 0
              && this.router.url.indexOf('/my-depositions') < 0 && !this.cachedEntry) {
              this.subscription$.unsubscribe();
              this.router.navigate(['/']).then();
            }
          }
        }
      }));
    }
  }

  private handleBroadcast(msg: BroadcastMessage): void {
    if (!msg?.type) {
      return;
    }
    if (msg.type === 'cleared') {
      if (this.cachedEntry) {
        this.entrySubject.next(null);
      }
      return;
    }
    if (msg.type === 'loaded' && msg.entryID) {
      // Another tab loaded a deposition — sync this tab so the two never diverge.
      if (!this.cachedEntry || this.cachedEntry.entryID !== msg.entryID) {
        this.loadEntry(msg.entryID, true);
      }
      return;
    }
    if (msg.type === 'mutated' && msg.entryID) {
      this.handleRemoteMutation(msg.entryID);
    }
  }

  private async handleRemoteMutation(entryID: string): Promise<void> {
    if (!this.cachedEntry || this.cachedEntry.entryID !== entryID) {
      return;
    }
    if (this.cachedEntry.unsaved) {
      // Both tabs have diverging edits — surface the conflict instead of silently dropping one side.
      this.showCrossTabConflict();
      return;
    }
    try {
      const [rawEntry, rawSchema] = await Promise.all([this.storage.get('entry'), this.storage.get('schema')]);
      if (!rawEntry || !rawSchema) {
        return;
      }
      const parsed = JSON.parse(rawEntry);
      parsed['schema'] = JSON.parse(rawSchema);
      const refreshed = entryFromJSON(parsed);
      // The IDB record may have `unsaved: true` because the *other* tab is mid-edit. This tab
      // is just a mirror; clearing the flag prevents the next broadcast from being misread as
      // a local-vs-remote conflict, and avoids two tabs autosaving the same pending change.
      refreshed.unsaved = false;
      this.seedSnapshots(refreshed);
      this.entrySubject.next(refreshed);
    } catch {
      console.error('Failed to refresh entry after cross-tab update.');
    }
  }

  private showCrossTabConflict(): void {
    if (this.conflictDialogOpen) {
      return;
    }
    this.conflictDialogOpen = true;
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = 'This deposition was just modified in another tab. Load those changes (losing ' +
      'unsaved edits made in this tab) or push your changes from this tab (overwriting what the other tab wrote)?';
    dialogRef.componentInstance.proceedMessage = 'Load changes from other tab';
    dialogRef.componentInstance.cancelMessage = 'Push my changes';
    dialogRef.afterClosed().subscribe(result => {
      this.conflictDialogOpen = false;
      if (!this.cachedEntry) {
        return;
      }
      if (result) {
        this.loadEntry(this.cachedEntry.entryID, true);
      } else if (result === false) {
        this.saveEntry(true);
      }
    });
  }

  private postBroadcast(msg: BroadcastMessage): void {
    try {
      this.broadcast.postMessage(msg);
    } catch (e) {
      console.error('BroadcastChannel post failed', e);
    }
  }

  clearDeposition(): void {
    this.storage.clearAll().then(() => this.postBroadcast({type: 'cleared'}));
    this.entrySubject.next(null);
  }

  /**
   * Resolves true if the caller is safe to proceed with a destructive action
   * (end session, load a different entry, etc.). If there is an active entry
   * with unsaved local changes, prompts the user to confirm first.
   *
   * `actionDescription` is interpolated into the prompt; phrase it so it works
   * after "if you …" — e.g. "end this session", "load a different deposition".
   */
  confirmDiscardUnsaved(actionDescription: string): Promise<boolean> {
    if (!this.cachedEntry?.unsaved) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>(resolve => {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
      dialogRef.componentInstance.confirmMessage =
        'You have local changes that have not yet been saved to the server (perhaps because you are offline or a recent ' +
        `save failed). If you ${actionDescription} now, those changes will be lost. Continue anyway?`;
      dialogRef.componentInstance.proceedMessage = 'Yes, discard changes';
      dialogRef.componentInstance.cancelMessage = 'Cancel';
      dialogRef.afterClosed().subscribe({next: result => resolve(result === true)});
    });
  }

  uploadFile(file: File): Observable<HttpEvent<FileUploadResponse>> {

    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file`;

    const formData = new FormData();
    formData.append('file', file);

    const options = {
      params: new HttpParams(),
      reportProgress: true,
    };

    const req = new HttpRequest<FormData>('POST', apiEndPoint, formData, options);
    return this.http.request<FileUploadResponse>(req);
  }

  deleteFile(fileName: string, verifyDeleted = false): void {
    const apiEndPoint = `${environment.serverURL}/${this.getEntryID()}/file/${fileName}`;
    this.http.delete<CommitResponse>(apiEndPoint).subscribe({
      next: response => {
        this.messagesService.sendMessage(new Message('File \'' + fileName + '\' deleted.'));
        if (!this.cachedEntry) {
          return;
        }
        this.cachedEntry.dataStore.deleteFile(fileName);
        this.cachedEntry.updateUploadedData();
        this.cachedEntry.refresh();
        this.cachedEntry.addCommit(response.commit);
        this.storeEntry(true);
      },
      error: () => {
        // verifyDeleted will be set if they cancel an upload
        if (!verifyDeleted) {
          this.messagesService.sendMessage(new Message('Failed to delete file. Do you have an internet connection?',
            MessageType.ErrorMessage, 15000));
        } else {
          this.messagesService.clearMessage();
          if (!this.cachedEntry) {
            return;
          }
          this.cachedEntry.dataStore.deleteFile(fileName);
          this.cachedEntry.updateUploadedData();
          this.cachedEntry.refresh();
        }
      }
    });
  }

  checkValidatedEmail(): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      if (!this.cachedEntry) {
        reject(new Error('No active entry.'));
        return;
      }
      const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}/check-valid`;
      // This fake header is just there for sake of https://github.com/aitboudad/ngx-loading-bar#http-client
      this.http.get<ValidationStatusResponse>(entryURL, {headers: {ignoreLoadingBar: ''}}).subscribe({
        next: response => {
          resolve(response.status);
        },
        error: error => {
          this.errorHandler.handle(error);
          reject();
        }
      });
    }));
  }

  checkLastCommit(): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      if (!this.cachedEntry) {
        reject(new Error('No active entry.'));
        return;
      }
      const entryURL = `${environment.serverURL}/${this.cachedEntry.entryID}/check-valid`;
      this.http.get<ValidationStatusResponse>(entryURL).subscribe({
        next: response => {
          resolve(this.cachedEntry!.checkCommit(response.commit));
        },
        error: error => {
          this.errorHandler.handle(error);
          reject();
        }
      });
    }));
  }

  loadEntry(entryID: string, skipMessage = false): void {
    const entryURL = `${environment.serverURL}/${entryID}`;
    if (!skipMessage) {
      this.messagesService.sendMessage(new Message(`Loading deposition ${entryID}...`));
    }
    this.http.get<EntryJSON>(entryURL).subscribe({
      next: jsonData => {
        if (!skipMessage) {
          this.messagesService.clearMessage();
        }
        const loadedEntry: Entry = entryFromJSON(jsonData);

        // Verify that the NMR-STAR matches the uploaded files
        let filesOutOfSync = false;
        if (jsonData.data_files) {
          const files: string[] = jsonData.data_files;
          for (const dataFile of files) {
            if (!(dataFile in loadedEntry.dataStore.dataFileMap)) {
              loadedEntry.dataStore.addFile(dataFile).percent = 100;
              filesOutOfSync = true;
            }
          }
        }

        this.seedSnapshots(loadedEntry);
        this.entrySubject.next(loadedEntry);
        Promise.all([
          this.storage.set('entry', JSON.stringify(loadedEntry)),
          this.storage.set('entryID', loadedEntry.entryID),
          this.storage.set('schema', JSON.stringify(loadedEntry.schema)),
        ]).then(() => {
          this.postBroadcast({type: 'loaded', entryID: loadedEntry.entryID});
        }).catch(err => {
          console.error('Failed to persist loaded entry to IndexedDB', err);
        });

        // Somehow the NMR-STAR data got out of sync with the uploaded files. Trigger a regeneration of the NMR-STAR, and a save.
        if (filesOutOfSync) {
          console.warn('Files detected as uploaded which are not present in NMR-STAR. Triggering re-save.');
          loadedEntry.updateUploadedData();
          loadedEntry.refresh();
          this.saveEntry();
        }
      },
      error: error => this.errorHandler.handle(error)
    });
  }

  storeEntry(dirty = false): void {

    if (this.cachedEntry) {
      // Saves an entry locally, and mark it as dirty first if need be
      if (dirty) {
        this.cachedEntry.unsaved = dirty;
        this.lastChangeTime = getTime();
      }
      const entryID = this.cachedEntry.entryID;
      const serialized = JSON.stringify(this.cachedEntry);
      Promise.all([
        this.storage.set('entry', serialized),
        this.storage.set('entryID', entryID),
      ]).then(() => this.postBroadcast({type: 'mutated', entryID}))
        .catch(err => console.error('Failed to persist entry to IndexedDB', err));
    } else {
      console.error('Asked to storeEntry, but no entry cached!');
    }
  }

  private seedSnapshots(entry: Entry): void {
    this.savedSaveframeSnapshots = new Map();
    for (const sf of entry.saveframes) {
      // Touch uniqueId before serializing: the getter is self-healing and will
      // add a `_Unique_ID` tag if the saveframe doesn't have one yet, so the
      // serialized snapshot must be taken after.
      const id = sf.uniqueId;
      this.savedSaveframeSnapshots.set(id, JSON.stringify(sf));
    }
  }

  private getDirtySaveframes(entry: Entry): { dirty: Saveframe[]; snapshots: Map<string, string> } {
    const dirty: Saveframe[] = [];
    const snapshots = new Map<string, string>();
    for (const sf of entry.saveframes) {
      const id = sf.uniqueId;
      const current = JSON.stringify(sf);
      if (this.savedSaveframeSnapshots.get(id) !== current) {
        dirty.push(sf);
        // Snapshot what we are *about* to send. If the user edits this saveframe
        // again before the request completes, the snapshot won't match the post-edit
        // value and the next save will correctly flag it dirty again.
        snapshots.set(id, current);
      }
    }
    return {dirty, snapshots};
  }

  saveEntry(override = true): void {

    if (!this.cachedEntry) {
      return;
    }
    const entry = this.cachedEntry;
    const {dirty, snapshots} = this.getDirtySaveframes(entry);

    // Nothing to send — clear the unsaved flag and be done.
    if (dirty.length === 0) {
      if (entry.unsaved) {
        entry.unsaved = false;
        this.lastChangeTime = null;
        this.storeEntry(false);
      }
      return;
    }

    const saveOriginTime = this.lastChangeTime;
    this.saveInProgress = true;

    const body: {commit: string[]; saveframes: Saveframe[]; force?: boolean} = {
      commit: entry.commit,
      saveframes: dirty,
    };
    if (override) {
      body.force = true;
    }
    const url = `${environment.serverURL}/${entry.entryID}/saveframes`;

    this.http.put<SaveEntryResponse>(url, JSON.stringify(body), this.JSONOptions).subscribe({
      next: response => {
        if ('error' in response) {
          entry.unsaved = true;
          const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            disableClose: false
          });

          dialogRef.componentInstance.confirmMessage = 'Changes to this deposition have been detected on the server - changes most ' +
            ' likely made from a different tab, browser, or computer. Would you like to load the changes from the server, ' +
            'losing your most recent changes, or push your changes to the server, overriding what is stored there? (If you are ' +
            'unsure, load changes from the server.) Note that you should only edit one deposition at a time, in one tab.';
          dialogRef.componentInstance.proceedMessage = 'Load changes from server';
          dialogRef.componentInstance.cancelMessage = 'Push changes to server';

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              this.loadEntry(entry.entryID, true);
            } else if (result === false) {
              // User chose to overwrite the server. Fall back to the full-entry PUT
              // so every saveframe (including ones the server has and we don't) is
              // replaced wholesale.
              this.saveEntryFull(true);
            }
            this.saveInProgress = false;
          });

        } else {
          // Commit is successful — update snapshots for the saveframes we just sent.
          for (const [uniqueId, snapshot] of snapshots) {
            this.savedSaveframeSnapshots.set(uniqueId, snapshot);
          }

          const time_diff: number = this.lastChangeTime === null ? 0 : Math.round((getTime() - this.lastChangeTime) / 1000);
          if (entry.unsaved && time_diff > 30) {
            this.messagesService.sendMessage(new Message('Successfully saved pending changes! You are back online.'));
          }

          if (!this.firstSaveMessageSent) {
            this.messagesService.sendMessage(new Message('Your changes have been saved - and they will continue to be automatically ' +
              'saved as you work.'));
            this.firstSaveMessageSent = true;
          }

          entry.addCommit(response.commit);
          if (saveOriginTime === this.lastChangeTime) {
            entry.unsaved = false;
            this.lastChangeTime = null;
          }
          this.storeEntry(false);
          this.saveInProgress = false;
        }
      },
      error: () => {
        if (entry.unsaved) {
          const time_diff: number = this.lastChangeTime === null ? 0 : Math.round((getTime() - this.lastChangeTime) / 1000);
          if (time_diff > 30 && time_diff < 180) {
            this.messagesService.sendMessage(new Message('Unable to save changes for the last ' + time_diff + ' seconds. ' +
              'Perhaps you have lost your internet connection? Changes can still be made to the deposition, but please don\'t close this tab ' +
              'until internet is restored and the entry can be saved - otherwise you may lose your progress!'));
          } else if (time_diff >= 180) {
            this.messagesService.sendMessage(new Message('Unable to save changes for the last ' + time_diff + ' seconds! Please check to ensure that ' +
              'you have a working internet connection. If so, please contact support. If this message persists and you keep making changes, you may lose them!', MessageType.ErrorMessage));
          }
        }
        this.saveInProgress = false;
      }
    });
  }

  /**
   * Fallback path: full-entry PUT to the legacy endpoint. Used when the user
   * elects to overwrite divergent server state — the incremental endpoint can
   * only replace saveframes the client knows about, so a true "push everything"
   * needs the full payload.
   */
  private saveEntryFull(override: boolean): void {
    if (!this.cachedEntry) {
      return;
    }
    const entry = this.cachedEntry;
    const saveOriginTime = this.lastChangeTime;
    this.saveInProgress = true;

    const entryURL = `${environment.serverURL}/${entry.entryID}`;
    const jsonObject: EntrySerialized = entry.toJSON();
    if (override) {
      jsonObject.force = true;
    }
    this.http.put<SaveEntryResponse>(entryURL, JSON.stringify(jsonObject), this.JSONOptions).subscribe({
      next: response => {
        if ('error' in response) {
          // A force=true full PUT should not get a reload response, but if the server
          // is in an unexpected state, surface the same conflict prompt rather than
          // silently failing.
          entry.unsaved = true;
          this.saveInProgress = false;
          this.messagesService.sendMessage(new Message(
            'Server reported a conflict on full-entry save. Please reload the page.',
            MessageType.ErrorMessage));
        } else {
          // After a full push, every saveframe on the server matches the client.
          this.seedSnapshots(entry);
          entry.addCommit(response.commit);
          if (saveOriginTime === this.lastChangeTime) {
            entry.unsaved = false;
            this.lastChangeTime = null;
          }
          this.storeEntry(false);
          this.saveInProgress = false;
        }
      },
      error: () => {
        this.saveInProgress = false;
      }
    });
  }
}
