import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {EntryComponent} from './entry/entry.component';
import {SaveframeEditorComponent} from './saveframe-editor/saveframe-editor.component';
import {WelcomeComponent} from './welcome/welcome.component';
import {ReviewComponent} from './review/review.component';
import {RestoreComponent} from './restore/restore.component';
import {MolecularSystemComponent} from './molecular-system/molecular-system.component';
import {PendingValidationComponent} from './pending-validation/pending-validation.component';
import {LoadEntryComponent} from './load-entry/load-entry.component';
import {ContactUsComponent} from './contact-us/contact-us.component';

const routes: Routes = [
  {path: '', component: WelcomeComponent},
  {path: 'entry', component: EntryComponent},
  {path: 'entry/load/:entry', component: LoadEntryComponent},
  {path: 'entry/saveframe/:saveframe_category', component: SaveframeEditorComponent},
  {path: 'entry/review', component: ReviewComponent},
  {path: 'entry/restore', component: RestoreComponent},
  {path: 'entry/pending-verification', component: PendingValidationComponent},
  {path: 'help/molecular-assembly', component: MolecularSystemComponent},
  {path: 'contact-us', component: ContactUsComponent}
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {scrollPositionRestoration: 'enabled'})
  ],
  exports: [
    RouterModule
  ]
})

export class AppRoutingModule {
}
