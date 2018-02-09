import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SaveframeComponent } from './saveframe/saveframe.component';
import { WelcomeComponent } from './welcome/welcome.component';

const routes: Routes = [
{ path: '', redirectTo: '/welcome', pathMatch: 'full'},
  { path: 'saveframe/:saveframe_name', component: SaveframeComponent },
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
