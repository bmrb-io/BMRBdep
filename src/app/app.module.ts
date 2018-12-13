import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

import {AppComponent} from './app.component';
import {SaveframeEditorComponent} from './saveframe-editor/saveframe-editor.component';
import {AppRoutingModule} from './app-routing.module';
import {WelcomeComponent} from './welcome/welcome.component';

// For the editor mode
import {LoopComponent} from './loop/loop.component';
import {SaveframeComponent} from './saveframe/saveframe.component';
import {EntryComponent} from './entry/entry.component';

// For the view only mode
import {LoopViewComponent} from './view_mode/loop/loop-view.component';
import {SaveframeViewComponent} from './view_mode/saveframe/saveframe-view.component';
import {TagComponent} from './tag/tag.component';
import {TreeViewComponent} from './treeview/tree-view.component';
import {FileUploaderComponent} from './file-uploader/file-uploader.component';
import {MessageComponent} from './message/message.component';

// Angular Material
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatProgressBarModule, MatSelectModule, MatSlideToggleModule} from '@angular/material';
import { ReviewComponent } from './review/review.component';

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
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    ReactiveFormsModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
