import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
// https://github.com/webcat12345/ngx-ui-switch
import { UiSwitchModule } from 'ngx-ui-switch';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { SaveframeComponent } from './saveframe/saveframe.component';
import { SaveframeViewComponent } from './saveframe_starview/saveframe.component';
import { SaveframeEditorComponent } from './saveframe-editor/saveframe-editor.component';
import { AppRoutingModule } from './app-routing.module';
import { WelcomeComponent } from './welcome/welcome.component';
import { ApiService } from './api.service';
import { LoopComponent } from './loop/loop.component';
import { EntryComponent } from './entry/entry.component';

// https://www.npmjs.com/package/angular2-ui-switch

@NgModule({
  declarations: [
    AppComponent,
    SaveframeComponent,
    SaveframeViewComponent,
    SaveframeEditorComponent,
    WelcomeComponent,
    LoopComponent,
    EntryComponent
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
