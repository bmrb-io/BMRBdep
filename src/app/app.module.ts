import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
// https://github.com/webcat12345/ngx-ui-switch
import { UiSwitchModule } from 'ngx-ui-switch';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { SaveframeEditorComponent } from './saveframe-editor/saveframe-editor.component';
import { AppRoutingModule } from './app-routing.module';
import { WelcomeComponent } from './welcome/welcome.component';
import { ApiService } from './api.service';

// For the editor mode
import { LoopComponent } from './loop/loop.component';
import { SaveframeComponent } from './saveframe/saveframe.component';
import { EntryComponent } from './entry/entry.component';

// For the view only mode
//import { LoopViewComponent } from './view_mode/loop/loop.component';
//import { SaveframeViewComponent } from './view_mode/saveframe/saveframe.component';

// https://www.npmjs.com/package/angular2-ui-switch

@NgModule({
  declarations: [
    AppComponent,
    WelcomeComponent,
    LoopComponent,
    SaveframeComponent,
    SaveframeEditorComponent,
    EntryComponent,
    //LoopViewComponent,
    //SaveframeViewComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    UiSwitchModule,
  ],
  providers: [ApiService],
  bootstrap: [AppComponent]
})
export class AppModule { }
