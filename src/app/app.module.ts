import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {WelcomeComponent} from './welcome/welcome.component';

// For the deposition mode
import {TagComponent} from './tag/tag.component';
import {LoopComponent} from './loop/loop.component';
import {SaveframeComponent} from './saveframe/saveframe.component';
import {EntryComponent} from './entry/entry.component';
import {SaveframeEditorComponent} from './saveframe-editor/saveframe-editor.component';
import {ReviewComponent} from './review/review.component';
import {TreeViewComponent} from './treeview/tree-view.component';
import {FileUploaderComponent} from './file-uploader/file-uploader.component';
import {MessageComponent} from './message/message.component';

// For the view only mode
import {LoopViewComponent} from './view_mode/loop/loop-view.component';
import {SaveframeViewComponent} from './view_mode/saveframe/saveframe-view.component';
import {RestoreComponent} from './restore/restore.component'; // Saving/loading bar

// Angular Material
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatProgressBarModule,
  MatSelectModule,
  MatSidenavModule,
  MatSlideToggleModule,
  MatToolbarModule
} from '@angular/material';

// From https://github.com/mika-el/angular-loading-page
import {LoadingPageModule, SlidingBarModule} from 'angular-loading-page'; // Saving/loading bar

// Compression
import { LZStringModule, LZStringService } from 'ng-lz-string';

@NgModule({
  declarations: [
    AppComponent,
    WelcomeComponent,
    LoopComponent,
    SaveframeComponent,
    SaveframeEditorComponent,
    EntryComponent,
    LoopViewComponent,
    SaveframeViewComponent,
    TagComponent,
    TreeViewComponent,
    FileUploaderComponent,
    MessageComponent,
    ReviewComponent,
    RestoreComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSidenavModule,
    MatInputModule,
    MatListModule,
    MatToolbarModule,
    MatIconModule,
    LoadingPageModule,
    SlidingBarModule,
    LZStringModule
  ],
  providers: [LZStringService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
