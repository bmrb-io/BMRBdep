import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSwitchModule } from 'angular2-ui-switch';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { SaveframeTagComponent } from './saveframe/saveframe-tag/saveframe-tag.component';
import { SaveframeComponent } from './saveframe/saveframe.component';
import { AppRoutingModule } from './app-routing.module';
import { WelcomeComponent } from './welcome/welcome.component';
import { ApiService } from './api.service';

// https://www.npmjs.com/package/angular2-ui-switch

@NgModule({
  declarations: [
    AppComponent,
    SaveframeTagComponent,
    SaveframeComponent,
    WelcomeComponent
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
