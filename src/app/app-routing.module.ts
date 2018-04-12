import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EntryComponent } from './entry/entry.component';
import { SaveframeEditorComponent } from './saveframe-editor/saveframe-editor.component';
import { WelcomeComponent } from './welcome/welcome.component';

const routes: Routes = [
{ path: '', redirectTo: '/entry/26000', pathMatch: 'full'},
  { path: 'entry/:entry', component: EntryComponent },
  { path: 'entry/:entry/saveframe/:saveframe_description/:load_type', component: SaveframeEditorComponent },
  { path: 'welcome', component: WelcomeComponent }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [
    RouterModule
  ]
})

export class AppRoutingModule { }
