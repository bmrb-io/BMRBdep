import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { SaveframeTagComponent } from './saveframe-tag/saveframe-tag.component';
import { SaveframeComponent } from './saveframe/saveframe.component';


@NgModule({
  declarations: [
    AppComponent,
    SaveframeTagComponent,
    SaveframeComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
