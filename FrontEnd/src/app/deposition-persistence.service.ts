import {BehaviorSubject, Observable, ReplaySubject, Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';
import {Entry, entryFromJSON, EntrySerialized} from './nmrstar/entry';
import {Saveframe} from './nmrstar/saveframe';
import {EntryJSON, SchemaJSON} from './nmrstar/schemaTypes';
import {Schema} from './nmrstar/schema';
import {inject, Injectable, OnDestroy} from '@angular/core';
import {HttpClient, HttpEvent, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {environment} from '../environments/environment';
import {Message, MessagesService, MessageType} from './messages.service';
import {NavigationEnd, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {ConfirmationDialogComponent} from './confirmation-dialog/confirmation-dialog.component';
import {MatDialog} from '@angular/material/dialog';
import {isStorageQuotaError, OpenDepositionRecord, StorageService} from './storage.service';

/**
 * Per-tab view of an open deposition, used to render the toolbar tab strip
 * and similar UI. Mirrors {@link OpenDepositionRecord} but adds `unsaved`,
 * which is intentionally per-tab and not persisted to IDB (two tabs can
 * disagree about whether they have local unsaved edits).
 */
export interface OpenDepositionView extends OpenDepositionRecord {
  unsaved: boolean;
}
import {ApiErrorHandler} from './api-error-handler.service';

interface BroadcastMessage {
  type: 'mutated' | 'loaded' | 'closed';
  entryID: string;
}

const BROADCAST_CHANNEL = 'bmrbdep';
const ACTIVE_ENTRY_SESSION_KEY = 'bmrbdep.activeEntryID';

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

interface DepositionState {
  entry: Entry;
  // Per-saveframe last-saved JSON snapshots, keyed by Saveframe.uniqueId.
  // Used to compute which saveframes are dirty so incremental save only sends
  // those. Repopulated on load, mutated only on successful save responses.
  savedSaveframeSnapshots: Map<string, string>;
  lastChangeTime: number | null;
  saveInProgress: boolean;
  // True for non-active depositions hydrated from storage; cleared when the
  // deposition is made active and a fresh commit check fires.
  needsCommitCheck: boolean;
}

function getTime(): number {
  return (new Date()).getTime();
}

function entryToRecord(entry: Entry, schemaVersion: string): OpenDepositionRecord {
  return {
    entryID: entry.entryID,
    schemaVersion,
    nickname: entry.depositionNickname,
    deposited: entry.deposited,
    bmrbnum: entry.bmrbnum,
  };
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

  // Emits the active deposition's Entry (or null when none is active). The
  // ~15 component subscribers continue to consume "the active deposition"
  // via this subject — implicit-active routing.
  public entrySubject: ReplaySubject<Entry | null>;

  // Per-tab open set + active pointer.
  private openDepositions = new Map<string, DepositionState>();
  private activeEntryID: string | null = null;

  // Drives the toolbar tab strip and other open-set consumers.
  public openDepositionsSubject = new BehaviorSubject<OpenDepositionView[]>([]);

  // Resolves once the initial IDB hydration pass is complete. Consumers that
  // need to distinguish "no open depositions" from "haven't checked yet" (e.g.
  // the My Depositions empty-state) should await this before drawing decisions
  // off `openDepositionsSubject.value`.
  public hydrationComplete: Promise<void>;
  private resolveHydration!: () => void;

  // Deduplicated per-version schema cache. Schemas are immutable per
  // deposition once issued by the server, so we can safely reuse a Schema
  // instance across every open deposition on the same version.
  private schemaCache = new Map<string, Schema>();

  private subscription$ = new Subscription();
  private saveTimer!: ReturnType<typeof setInterval>;
  private firstSaveMessageSent: boolean = false;
  private broadcast!: BroadcastChannel;
  // Suppress overlapping conflict dialogs per deposition rather than globally —
  // a flurry of failed background saves shouldn't spawn N dialogs for one entry.
  private conflictDialogOpen = new Set<string>();
  // Count of in-flight file uploads across all open depositions. Gates the
  // deposit button so the user can't submit while a large upload is still
  // streaming to the server.
  private activeUploads = 0;

  private JSONOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor() {
    this.entrySubject = new ReplaySubject<Entry | null>();
    this.hydrationComplete = new Promise<void>(resolve => { this.resolveHydration = resolve; });

    this.broadcast = new BroadcastChannel(BROADCAST_CHANNEL);
    this.broadcast.onmessage = ev => this.handleBroadcast(ev.data as BroadcastMessage);

    this.hydrateFromStorage();

    // Used to open verification links in same tab
    window.name = 'BMRBdep';

    this.saveTimer = setInterval(() => {
      // Walk every open deposition and save the ones with armed unsaved edits.
      for (const [entryID, state] of this.openDepositions) {
        if (state.entry.unsaved && state.lastChangeTime !== null && !state.saveInProgress) {
          this.saveEntry(true, entryID);
        }
      }
    }, 5000);
  }

  ngOnDestroy() {
    this.subscription$.unsubscribe();
    clearInterval(this.saveTimer);
    this.broadcast.close();
  }

  get currentEntry(): Entry | null {
    return this.activeEntryID ? this.openDepositions.get(this.activeEntryID)?.entry ?? null : null;
  }

  getEntryID(): string | null {
    return this.activeEntryID;
  }

  getOpenDepositionRecords(): OpenDepositionView[] {
    return this.openDepositionsSubject.value;
  }

  anyUnsaved(): boolean {
    for (const state of this.openDepositions.values()) {
      if (state.entry.unsaved) return true;
    }
    return false;
  }

  /**
   * True while any background work that should block a deposit is in flight —
   * primarily file uploads (which can be long), but also an in-progress
   * incremental saveframe save on the active deposition.
   */
  get saveInProgress(): boolean {
    if (this.activeUploads > 0) return true;
    const state = this.getState(this.activeEntryID);
    return !!state?.saveInProgress;
  }

  isOpen(entryID: string): boolean {
    return this.openDepositions.has(entryID);
  }

  private getState(entryID: string | null): DepositionState | null {
    if (!entryID) return null;
    return this.openDepositions.get(entryID) ?? null;
  }

  /**
   * Flip the active deposition slot. Persists to sessionStorage so a tab
   * refresh restores the same active entry, emits on `entrySubject`, and
   * updates the document title.
   *
   * If the target was hydrated from storage and never had its commit checked,
   * fire the check now (deferred from hydrate to avoid prompt storms when
   * multiple depositions are restored).
   */
  setActive(entryID: string | null): void {
    if (entryID && !this.openDepositions.has(entryID)) {
      console.error(`setActive called with unknown entryID ${entryID}`);
      return;
    }
    this.activeEntryID = entryID;
    if (entryID) {
      try {
        sessionStorage.setItem(ACTIVE_ENTRY_SESSION_KEY, entryID);
      } catch { /* sessionStorage can be unavailable in private windows */ }
      const state = this.openDepositions.get(entryID)!;
      this.titleService.setTitle(`BMRBdep: ${state.entry.depositionNickname}`);
      this.entrySubject.next(state.entry);
      if (state.needsCommitCheck) {
        state.needsCommitCheck = false;
        this.checkLastCommit(entryID).then(foundCommit => {
          if (!foundCommit) {
            this.refetchEntry(entryID, true);
          }
        }).catch(() => { /* retry timer / next activation will pick it up */ });
      }
    } else {
      try {
        sessionStorage.removeItem(ACTIVE_ENTRY_SESSION_KEY);
      } catch { /* ignore */ }
      this.titleService.setTitle('BMRBdep');
      this.entrySubject.next(null);
    }
  }

  /**
   * Close a deposition: drops it from this tab's open set, removes its IDB
   * record, broadcasts the close so peer tabs drop it too, and (if it was
   * active) promotes another open deposition to active.
   */
  async closeDeposition(entryID: string): Promise<void> {
    const state = this.openDepositions.get(entryID);
    if (!state) return;
    this.openDepositions.delete(entryID);
    try {
      await this.storage.deleteEntry(entryID);
      await this.persistIndex();
    } catch (e) {
      console.error('Failed to remove deposition from storage', e);
    }
    this.postBroadcast({type: 'closed', entryID});
    this.emitOpenDepositions();
    if (this.activeEntryID === entryID) {
      const fallback = this.openDepositions.keys().next().value ?? null;
      this.setActive(fallback);
    }
  }

  /**
   * Closes every open deposition. If any have unsaved local changes, prompts
   * once with an aggregate message; the user can cancel to abort the whole
   * operation. Returns true if everything closed, false if cancelled.
   */
  async signOut(): Promise<boolean> {
    const openIDs = Array.from(this.openDepositions.keys());
    if (openIDs.length === 0) return true;
    if (this.anyUnsaved()) {
      const confirmed = await new Promise<boolean>(resolve => {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
        dialogRef.componentInstance.confirmMessage =
          'You have local changes in one or more open depositions that have not yet been saved to the server. ' +
          'If you sign out now, those changes will be lost. Continue anyway?';
        dialogRef.componentInstance.proceedMessage = 'Yes, discard changes';
        dialogRef.componentInstance.cancelMessage = 'Cancel';
        dialogRef.afterClosed().subscribe({next: result => resolve(result === true)});
      });
      if (!confirmed) return false;
    }
    for (const id of openIDs) {
      await this.closeDeposition(id);
    }
    return true;
  }

  /**
   * Resolves true if the caller is safe to proceed with a destructive action
   * (close a deposition, sign out, etc.). Prompts when the deposition has
   * unsaved local changes. `actionDescription` is interpolated after "if you …"
   * — e.g. "close this deposition", "sign out".
   */
  confirmDiscardUnsaved(actionDescription: string, entryID: string | null = this.activeEntryID): Promise<boolean> {
    const state = this.getState(entryID);
    if (!state?.entry.unsaved) {
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
    this.activeUploads += 1;
    return this.http.request<FileUploadResponse>(req).pipe(
      finalize(() => { this.activeUploads -= 1; })
    );
  }

  deleteFile(fileName: string, verifyDeleted = false): void {
    const entryID = this.activeEntryID;
    const state = this.getState(entryID);
    if (!state || !entryID) return;
    const apiEndPoint = `${environment.serverURL}/${entryID}/file/${fileName}`;
    this.http.delete<CommitResponse>(apiEndPoint).subscribe({
      next: response => {
        this.messagesService.sendMessage(new Message('File \'' + fileName + '\' deleted.'));
        const current = this.getState(entryID);
        if (!current) return;
        current.entry.dataStore.deleteFile(fileName);
        current.entry.updateUploadedData();
        current.entry.refresh();
        current.entry.addCommit(response.commit);
        this.storeEntry(true, entryID);
      },
      error: () => {
        // verifyDeleted will be set if they cancel an upload
        if (!verifyDeleted) {
          this.messagesService.sendMessage(new Message('Failed to delete file. Do you have an internet connection?',
            MessageType.ErrorMessage, 15000));
        } else {
          this.messagesService.clearMessage();
          const current = this.getState(entryID);
          if (!current) return;
          current.entry.dataStore.deleteFile(fileName);
          current.entry.updateUploadedData();
          current.entry.refresh();
        }
      }
    });
  }

  checkValidatedEmail(entryID: string | null = this.activeEntryID): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      const state = this.getState(entryID);
      if (!state || !entryID) {
        reject(new Error('No active entry.'));
        return;
      }
      const entryURL = `${environment.serverURL}/${entryID}/check-valid`;
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

  checkLastCommit(entryID: string | null = this.activeEntryID): Promise<boolean> {
    return new Promise(((resolve, reject) => {
      const state = this.getState(entryID);
      if (!state || !entryID) {
        reject(new Error('No active entry.'));
        return;
      }
      const entryURL = `${environment.serverURL}/${entryID}/check-valid`;
      this.http.get<ValidationStatusResponse>(entryURL).subscribe({
        next: response => {
          resolve(state.entry.checkCommit(response.commit));
        },
        error: error => {
          this.errorHandler.handle(error);
          reject();
        }
      });
    }));
  }

  /**
   * Refetch an entry from the server, replacing the in-memory copy if any.
   * Use this when the caller explicitly wants fresh server state (e.g. the
   * tree-view "Refresh" button, or conflict-resolution after a divergent save).
   * `loadEntry` short-circuits when the entry is already open, so it can't
   * stand in for a forced refetch.
   */
  refetchEntry(entryID: string, skipMessage = false): void {
    this.openDepositions.delete(entryID);
    this.loadEntry(entryID, skipMessage);
  }

  /**
   * Load a deposition. If it is already open in this tab, just make it
   * active. Otherwise fetch from the server, dedup the schema, add to the
   * open set, persist, and make active. Broadcasts to peer tabs so any
   * tab that already has this entry open can refresh in place.
   */
  loadEntry(entryID: string, skipMessage = false): void {
    if (this.openDepositions.has(entryID)) {
      this.setActive(entryID);
      return;
    }

    const entryURL = `${environment.serverURL}/${entryID}`;
    if (!skipMessage) {
      this.messagesService.sendMessage(new Message(`Loading deposition ${entryID}...`));
    }
    this.http.get<EntryJSON>(entryURL).subscribe({
      next: async jsonData => {
        if (!skipMessage) {
          this.messagesService.clearMessage();
        }
        const schemaJson = jsonData.schema;
        const schema = this.resolveSchema(schemaJson.version, schemaJson);
        // entryFromJSON expects schema bundled; reuse the cached instance.
        const loadedEntry: Entry = entryFromJSON(jsonData);
        loadedEntry.schema = schema;

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

        const state: DepositionState = {
          entry: loadedEntry,
          savedSaveframeSnapshots: new Map(),
          lastChangeTime: null,
          saveInProgress: false,
          needsCommitCheck: false,
        };
        this.seedSnapshots(state);
        this.openDepositions.set(entryID, state);

        // Block the load on the IDB write. If it fails (most commonly quota
        // exceeded) we'd rather refuse the load than leave an in-memory entry
        // that silently won't survive a refresh.
        try {
          await this.persistEntry(state, schemaJson);
        } catch (err) {
          this.openDepositions.delete(entryID);
          // Best-effort cleanup: the entry blob and/or the index may have
          // landed before the failure. If these also fail (still quota) the
          // catches swallow it — in-memory state is the part that matters.
          this.storage.deleteEntry(entryID).catch(() => { /* ignore */ });
          this.persistIndex().catch(() => { /* ignore */ });
          this.emitOpenDepositions();
          this.handleStorageFailure(err, 'load this deposition');
          return;
        }
        this.postBroadcast({type: 'loaded', entryID});

        this.emitOpenDepositions();
        this.setActive(entryID);

        // Somehow the NMR-STAR data got out of sync with the uploaded files. Trigger a regeneration of the NMR-STAR, and a save.
        if (filesOutOfSync) {
          console.warn('Files detected as uploaded which are not present in NMR-STAR. Triggering re-save.');
          loadedEntry.updateUploadedData();
          loadedEntry.refresh();
          this.saveEntry(true, entryID);
        }
      },
      error: error => this.errorHandler.handle(error)
    });
  }

  /**
   * Surface an IDB write failure on the load path to the user and get them
   * off the now-dead /entry/load/:id route. Quota-exceeded gets a tailored
   * message since the user can act on it (close other depositions, free up
   * browser storage); anything else gets a generic message.
   */
  private handleStorageFailure(err: unknown, action: string): void {
    if (isStorageQuotaError(err)) {
      this.messagesService.sendMessage(new Message(
        `Your browser's local storage for this site is full, so we could not ${action}. ` +
        'Please close one or more open depositions (or free up browser storage for this site) and try again. ' +
        'The deposition was not opened so that you do not lose work to a failed save.',
        MessageType.ErrorMessage, 30000));
    } else {
      console.error('IndexedDB write failed', err);
      this.messagesService.sendMessage(new Message(
        `Your browser blocked the local save needed to ${action}, so the deposition was not opened. ` +
        'Please try again, and contact support if the problem persists.',
        MessageType.ErrorMessage, 30000));
    }
    // The user is sitting on /entry/load/:id waiting on an entrySubject emission
    // that will never come. Send them somewhere sensible.
    if (this.activeEntryID) {
      this.router.navigate(['/entry']).then();
    } else {
      this.router.navigate(['/']).then();
    }
  }

  /**
   * Persist an entry and (if not already cached) its schema to IDB, plus
   * refresh the openDepositions index. The index is rewritten from the
   * in-memory Map order so user-applied reordering survives saves.
   */
  private async persistEntry(state: DepositionState, schemaJson: SchemaJSON | null): Promise<void> {
    const entry = state.entry;
    const entrySerialized = JSON.stringify(entry);
    const entryJson = JSON.parse(entrySerialized);
    delete entryJson.schema;
    const version = entry.schema.version;

    const tasks: Promise<unknown>[] = [
      this.storage.setEntry(entry.entryID, JSON.stringify(entryJson)),
    ];
    if (schemaJson && !(await this.storage.hasSchema(version))) {
      tasks.push(this.storage.setSchema(version, JSON.stringify(schemaJson)));
    }
    await Promise.all(tasks);
    await this.persistIndex();
  }

  /**
   * Snapshot the in-memory openDepositions Map to the IDB index. Map insertion
   * order is the single source of truth for chip-strip / my-depositions
   * ordering; persisting in that order keeps a user reorder stable across
   * reloads and across mutations from save flows.
   */
  private persistIndex(): Promise<void> {
    const list: OpenDepositionRecord[] = [];
    for (const state of this.openDepositions.values()) {
      list.push(entryToRecord(state.entry, state.entry.schema.version));
    }
    return this.storage.setOpenDepositions(list);
  }

  /**
   * Reorder the open-deposition Map to match the supplied entryID sequence.
   * Unknown IDs are dropped and currently-open IDs not mentioned are appended
   * to the end, so callers can pass a partial order without losing entries.
   */
  reorderDepositions(orderedIDs: string[]): void {
    const reordered = new Map<string, DepositionState>();
    for (const id of orderedIDs) {
      const state = this.openDepositions.get(id);
      if (state) {
        reordered.set(id, state);
      }
    }
    for (const [id, state] of this.openDepositions) {
      if (!reordered.has(id)) {
        reordered.set(id, state);
      }
    }
    this.openDepositions = reordered;
    this.emitOpenDepositions();
    this.persistIndex().catch(err => console.error('Failed to persist openDepositions reorder', err));
  }

  storeEntry(dirty = false, entryID: string | null = this.activeEntryID): void {
    const state = this.getState(entryID);
    if (!state || !entryID) {
      console.error('Asked to storeEntry, but no entry cached!');
      return;
    }
    if (dirty) {
      state.entry.unsaved = dirty;
      state.lastChangeTime = getTime();
    }
    const entrySerialized = JSON.stringify(state.entry);
    const entryJson = JSON.parse(entrySerialized);
    delete entryJson.schema;
    this.storage.setEntry(entryID, JSON.stringify(entryJson))
      .then(() => this.postBroadcast({type: 'mutated', entryID}))
      .catch(err => console.error('Failed to persist entry to IndexedDB', err));
    // Refresh the index (nickname / deposited / bmrbnum can change). Use the
    // Map-order snapshot so the touched entry doesn't get shuffled around.
    this.persistIndex().catch(err => console.error('Failed to update openDepositions index', err));
    this.emitOpenDepositions();
    // Kick off a save immediately on user-initiated changes so the server picks
    // them up on blur rather than after the 5s retry tick. The saveInProgress
    // guard coalesces rapid edits; the post-save check in saveEntry catches
    // anything that landed during the in-flight request, and the interval
    // timer remains the backstop for offline / failed saves.
    if (dirty && !state.saveInProgress) {
      this.saveEntry(true, entryID);
    }
  }

  saveEntry(override = true, entryID: string | null = this.activeEntryID): void {
    const state = this.getState(entryID);
    if (!state || !entryID) return;
    const entry = state.entry;
    const {dirty, snapshots} = this.getDirtySaveframes(state);

    // Nothing to send — clear the unsaved flag and be done.
    if (dirty.length === 0) {
      if (entry.unsaved) {
        entry.unsaved = false;
        state.lastChangeTime = null;
        this.storeEntry(false, entryID);
      }
      return;
    }

    const saveOriginTime = state.lastChangeTime;
    state.saveInProgress = true;

    const body: {commit: string[]; saveframes: Saveframe[]; force?: boolean} = {
      commit: entry.commit,
      saveframes: dirty,
    };
    if (override) {
      body.force = true;
    }
    const url = `${environment.serverURL}/${entryID}/saveframes`;

    this.http.put<SaveEntryResponse>(url, JSON.stringify(body), this.JSONOptions).subscribe({
      next: response => {
        if ('error' in response) {
          entry.unsaved = true;
          if (this.conflictDialogOpen.has(entryID)) {
            state.saveInProgress = false;
            return;
          }
          this.conflictDialogOpen.add(entryID);
          const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            disableClose: false
          });

          const nickname = entry.depositionNickname ?? entryID;
          dialogRef.componentInstance.confirmMessage = `Changes to deposition "${nickname}" have been detected on the server - changes most ` +
            'likely made from a different tab, browser, or computer. Would you like to load the changes from the server, ' +
            'losing your most recent changes, or push your changes to the server, overriding what is stored there? (If you are ' +
            'unsure, load changes from the server.)';
          dialogRef.componentInstance.proceedMessage = 'Load changes from server';
          dialogRef.componentInstance.cancelMessage = 'Push changes to server';

          dialogRef.afterClosed().subscribe(result => {
            this.conflictDialogOpen.delete(entryID);
            if (result) {
              this.refetchEntry(entryID, true);
            } else if (result === false) {
              // User chose to overwrite the server. Fall back to the full-entry PUT
              // so every saveframe (including ones the server has and we don't) is
              // replaced wholesale.
              this.saveEntryFull(true, entryID);
            }
            state.saveInProgress = false;
          });

        } else {
          // Commit is successful — update snapshots for the saveframes we just sent.
          for (const [uniqueId, snapshot] of snapshots) {
            state.savedSaveframeSnapshots.set(uniqueId, snapshot);
          }

          const time_diff: number = state.lastChangeTime === null ? 0 : Math.round((getTime() - state.lastChangeTime) / 1000);
          if (entry.unsaved && time_diff > 30) {
            this.messagesService.sendMessage(new Message('Successfully saved pending changes! You are back online.'));
          }

          if (!this.firstSaveMessageSent) {
            this.messagesService.sendMessage(new Message('Your changes have been saved - and they will continue to be automatically ' +
              'saved as you work.'));
            this.firstSaveMessageSent = true;
          }

          entry.addCommit(response.commit);
          if (saveOriginTime === state.lastChangeTime) {
            entry.unsaved = false;
            state.lastChangeTime = null;
          }
          this.storeEntry(false, entryID);
          state.saveInProgress = false;
          // A change landed while the request was in flight (lastChangeTime
          // advanced past saveOriginTime). Fire another save now rather than
          // waiting for the 5s retry tick.
          if (entry.unsaved) {
            this.saveEntry(true, entryID);
          }
        }
      },
      error: () => {
        if (entry.unsaved) {
          const time_diff: number = state.lastChangeTime === null ? 0 : Math.round((getTime() - state.lastChangeTime) / 1000);
          if (time_diff > 30 && time_diff < 180) {
            this.messagesService.sendMessage(new Message('Unable to save changes for the last ' + time_diff + ' seconds. ' +
              'Perhaps you have lost your internet connection? Changes can still be made to the deposition, but please don\'t close this tab ' +
              'until internet is restored and the entry can be saved - otherwise you may lose your progress!'));
          } else if (time_diff >= 180) {
            this.messagesService.sendMessage(new Message('Unable to save changes for the last ' + time_diff + ' seconds! Please check to ensure that ' +
              'you have a working internet connection. If so, please contact support. If this message persists and you keep making changes, you may lose them!', MessageType.ErrorMessage));
          }
        }
        state.saveInProgress = false;
      }
    });
  }

  /**
   * Fallback path: full-entry PUT to the legacy endpoint. Used when the user
   * elects to overwrite divergent server state — the incremental endpoint can
   * only replace saveframes the client knows about, so a true "push everything"
   * needs the full payload.
   */
  private saveEntryFull(override: boolean, entryID: string): void {
    const state = this.getState(entryID);
    if (!state) return;
    const entry = state.entry;
    const saveOriginTime = state.lastChangeTime;
    state.saveInProgress = true;

    const entryURL = `${environment.serverURL}/${entryID}`;
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
          state.saveInProgress = false;
          this.messagesService.sendMessage(new Message(
            'Server reported a conflict on full-entry save. Please reload the page.',
            MessageType.ErrorMessage));
        } else {
          // After a full push, every saveframe on the server matches the client.
          this.seedSnapshots(state);
          entry.addCommit(response.commit);
          if (saveOriginTime === state.lastChangeTime) {
            entry.unsaved = false;
            state.lastChangeTime = null;
          }
          this.storeEntry(false, entryID);
          state.saveInProgress = false;
        }
      },
      error: () => {
        state.saveInProgress = false;
      }
    });
  }

  /**
   * Hydrate open depositions and active pointer from IDB + sessionStorage.
   * Schemas are deduped via `resolveSchema`. Non-active depositions defer
   * their commit check to `setActive` to avoid hydrate-time prompt storms.
   */
  private async hydrateFromStorage(): Promise<void> {
    let records: OpenDepositionRecord[];
    try {
      records = await this.storage.getOpenDepositions();
    } catch {
      console.error('Failed to read openDepositions index from IDB');
      records = [];
    }

    if (records.length === 0) {
      this.subscription$.add(this.router.events.subscribe({
        next: event => {
          if (event instanceof NavigationEnd) {
            if (this.router.url.indexOf('/load/') < 0 && this.router.url.indexOf('/help') < 0 && this.router.url.indexOf('/support') < 0
              && this.router.url.indexOf('/my-depositions') < 0 && this.router.url.indexOf('/admin') < 0 && !this.currentEntry) {
              this.subscription$.unsubscribe();
              this.router.navigate(['/']).then();
            }
          }
        }
      }));
      this.emitOpenDepositions();
      this.entrySubject.next(null);
      this.resolveHydration();
      return;
    }

    let storedActive: string | null = null;
    try {
      storedActive = sessionStorage.getItem(ACTIVE_ENTRY_SESSION_KEY);
    } catch { /* sessionStorage unavailable — fall back to first */ }

    for (const record of records) {
      try {
        const [rawEntry, rawSchema] = await Promise.all([
          this.storage.getEntry(record.entryID),
          this.storage.getSchema(record.schemaVersion),
        ]);
        if (!rawEntry || !rawSchema) {
          // IDB invariant broken — refetch this entry from the server (it will land in
          // the open set with the right schema on response).
          console.warn(`Missing IDB record for entry ${record.entryID} or schema ${record.schemaVersion}; refetching.`);
          this.loadEntry(record.entryID, true);
          continue;
        }
        const schemaJson = JSON.parse(rawSchema) as SchemaJSON;
        const schema = this.resolveSchema(record.schemaVersion, schemaJson);
        const entryJson = JSON.parse(rawEntry);
        entryJson.schema = schemaJson;
        const entry = entryFromJSON(entryJson);
        entry.schema = schema;

        const state: DepositionState = {
          entry,
          savedSaveframeSnapshots: new Map(),
          lastChangeTime: null,
          saveInProgress: false,
          needsCommitCheck: true,
        };
        // Only seed snapshots if the cached entry is clean. The snapshot map is
        // the in-memory record of "what the server has"; if the entry was unsaved
        // when persisted, the IDB copy already diverges from the server, and
        // seeding from it would make every saveframe look clean, causing the next
        // save to early-return without pushing anything. Leaving the map empty
        // marks every saveframe dirty so the post-refresh save sends them all.
        if (!entry.unsaved) {
          this.seedSnapshots(state);
        } else {
          // Arm lastChangeTime so the retry timer keeps pushing this deposition
          // even if no UI interaction occurs (e.g. came back online after refresh).
          state.lastChangeTime = getTime();
        }
        this.openDepositions.set(record.entryID, state);
      } catch (e) {
        console.error(`Failed to hydrate deposition ${record.entryID}`, e);
      }
    }

    this.emitOpenDepositions();

    const fallback = this.openDepositions.keys().next().value ?? null;
    const active = (storedActive && this.openDepositions.has(storedActive)) ? storedActive : fallback;
    this.setActive(active);

    // For unsaved depositions other than the freshly-activated one, kick a save
    // attempt — the timer will pick them up too but this gives an immediate try.
    for (const [entryID, state] of this.openDepositions) {
      if (entryID !== active && state.entry.unsaved) {
        this.saveEntry(true, entryID);
      }
    }

    this.resolveHydration();
  }

  /**
   * Resolve a Schema for a given version. Returns the cached instance if any.
   * Otherwise constructs from the provided JSON, caches, and returns. Throws
   * if no cached schema exists and no fallback was provided.
   */
  private resolveSchema(version: string, fallbackJson: SchemaJSON | null): Schema {
    const cached = this.schemaCache.get(version);
    if (cached) return cached;
    if (!fallbackJson) {
      throw new Error(`Schema version ${version} not cached and no fallback provided`);
    }
    const schema = new Schema(fallbackJson);
    this.schemaCache.set(version, schema);
    return schema;
  }

  private emitOpenDepositions(): void {
    const views: OpenDepositionView[] = [];
    for (const state of this.openDepositions.values()) {
      views.push({
        ...entryToRecord(state.entry, state.entry.schema.version),
        unsaved: state.entry.unsaved,
      });
    }
    this.openDepositionsSubject.next(views);
  }

  private handleBroadcast(msg: BroadcastMessage): void {
    if (!msg?.type || !msg.entryID) return;
    const entryID = msg.entryID;
    if (msg.type === 'closed') {
      const state = this.openDepositions.get(entryID);
      if (!state) return;
      this.openDepositions.delete(entryID);
      this.emitOpenDepositions();
      if (this.activeEntryID === entryID) {
        const fallback = this.openDepositions.keys().next().value ?? null;
        this.setActive(fallback);
      }
      return;
    }
    if (msg.type === 'loaded' || msg.type === 'mutated') {
      // Per user constraint: inactive tabs never auto-switch. If we have this
      // entry open, refresh its in-memory copy; otherwise ignore entirely.
      if (this.openDepositions.has(entryID)) {
        this.handleRemoteMutation(entryID);
      }
      return;
    }
  }

  private async handleRemoteMutation(entryID: string): Promise<void> {
    const state = this.openDepositions.get(entryID);
    if (!state) return;
    if (state.entry.unsaved) {
      // Both tabs have diverging edits — surface the conflict instead of silently dropping one side.
      this.showCrossTabConflict(entryID);
      return;
    }
    try {
      const [rawEntry, rawSchema] = await Promise.all([
        this.storage.getEntry(entryID),
        this.storage.getSchema(state.entry.schema.version),
      ]);
      if (!rawEntry || !rawSchema) return;
      const schemaJson = JSON.parse(rawSchema) as SchemaJSON;
      const schema = this.resolveSchema(schemaJson.version, schemaJson);
      const parsed = JSON.parse(rawEntry);
      parsed.schema = schemaJson;
      const refreshed = entryFromJSON(parsed);
      refreshed.schema = schema;
      // The IDB record may have `unsaved: true` because the *other* tab is mid-edit. This tab
      // is just a mirror; clearing the flag prevents the next broadcast from being misread as
      // a local-vs-remote conflict, and avoids two tabs autosaving the same pending change.
      refreshed.unsaved = false;
      const newState: DepositionState = {
        entry: refreshed,
        savedSaveframeSnapshots: new Map(),
        lastChangeTime: null,
        saveInProgress: false,
        needsCommitCheck: false,
      };
      this.seedSnapshots(newState);
      this.openDepositions.set(entryID, newState);
      this.emitOpenDepositions();
      if (this.activeEntryID === entryID) {
        this.entrySubject.next(refreshed);
      }
    } catch {
      console.error('Failed to refresh entry after cross-tab update.');
    }
  }

  private showCrossTabConflict(entryID: string): void {
    if (this.conflictDialogOpen.has(entryID)) return;
    const state = this.openDepositions.get(entryID);
    if (!state) return;
    this.conflictDialogOpen.add(entryID);
    const nickname = state.entry.depositionNickname ?? entryID;
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {disableClose: false});
    dialogRef.componentInstance.confirmMessage = `Deposition "${nickname}" was just modified in another tab. Load those changes (losing ` +
      'unsaved edits made in this tab) or push your changes from this tab (overwriting what the other tab wrote)?';
    dialogRef.componentInstance.proceedMessage = 'Load changes from other tab';
    dialogRef.componentInstance.cancelMessage = 'Push my changes';
    dialogRef.afterClosed().subscribe(result => {
      this.conflictDialogOpen.delete(entryID);
      if (!this.openDepositions.has(entryID)) return;
      if (result) {
        this.refetchEntry(entryID, true);
      } else if (result === false) {
        this.saveEntry(true, entryID);
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

  private seedSnapshots(state: DepositionState): void {
    state.savedSaveframeSnapshots = new Map();
    for (const sf of state.entry.saveframes) {
      // Touch uniqueId before serializing: the getter is self-healing and will
      // add a `_Unique_ID` tag if the saveframe doesn't have one yet, so the
      // serialized snapshot must be taken after.
      const id = sf.uniqueId;
      state.savedSaveframeSnapshots.set(id, JSON.stringify(sf));
    }
  }

  private getDirtySaveframes(state: DepositionState): { dirty: Saveframe[]; snapshots: Map<string, string> } {
    const dirty: Saveframe[] = [];
    const snapshots = new Map<string, string>();
    for (const sf of state.entry.saveframes) {
      const id = sf.uniqueId;
      const current = JSON.stringify(sf);
      if (state.savedSaveframeSnapshots.get(id) !== current) {
        dirty.push(sf);
        // Snapshot what we are *about* to send. If the user edits this saveframe
        // again before the request completes, the snapshot won't match the post-edit
        // value and the next save will correctly flag it dirty again.
        snapshots.set(id, current);
      }
    }
    return {dirty, snapshots};
  }
}
