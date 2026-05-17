import {inject} from '@angular/core';
import {CanActivateFn} from '@angular/router';
import {DepositionPersistenceService} from './deposition-persistence.service';

/**
 * Guards the `/entry/load/:entry` route: if the user has an active deposition
 * with unsaved local changes and is about to load a *different* deposition,
 * prompts before allowing the navigation. Same-entry reloads (used by the
 * cross-tab sync path and by `refresh()`) and navigations from a fresh
 * session always pass through.
 */
export const confirmLoadEntryGuard: CanActivateFn = route => {
  const persistence = inject(DepositionPersistenceService);
  const requestedId = route.paramMap.get('entry');
  const current = persistence.currentEntry;
  if (!current || !current.unsaved || current.entryID === requestedId) {
    return true;
  }
  return persistence.confirmDiscardUnsaved('load a different deposition');
};
