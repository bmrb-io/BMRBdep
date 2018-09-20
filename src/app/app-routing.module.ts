import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

import {EntryComponent} from './entry/entry.component';
import {SaveframeEditorComponent} from './saveframe-editor/saveframe-editor.component';
import {WelcomeComponent} from './welcome/welcome.component';
import {ReviewComponent} from './review/review.component';

const routes: Routes = [
  {path: '', component: WelcomeComponent},
  {path: 'entry/:entry', component: EntryComponent},
  {path: 'entry/:entry/saveframe/:saveframe_description/:load_type', component: SaveframeEditorComponent},
  {path: 'entry/:entry/review', component: ReviewComponent}
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [
    RouterModule
  ]
})

export class AppRoutingModule {
}
