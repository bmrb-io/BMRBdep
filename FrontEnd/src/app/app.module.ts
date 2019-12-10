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
import {MolecularSystemComponent} from './molecular-system/molecular-system.component';
import {PendingValidationComponent} from './pending-validation/pending-validation.component';
import {LoadEntryComponent} from './load-entry/load-entry.component';
import {ConfirmationDialogComponent} from './confirmation-dialog/confirmation-dialog.component';


// For the view only mode
import {LoopViewComponent} from './view_mode/loop/loop-view.component';
import {SaveframeViewComponent} from './view_mode/saveframe/saveframe-view.component';
import {RestoreComponent} from './restore/restore.component'; // Saving/loading bar

// From https://github.com/mika-el/angular-loading-page
import {LoadingPageModule, SlidingBarModule} from 'angular-loading-page';
import {ContactUsComponent} from './contact-us/contact-us.component';

// Angular Material
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDialogModule} from '@angular/material/dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectModule} from '@angular/material/select';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatAutocompleteModule} from '@angular/material';

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
    ReviewComponent,
    RestoreComponent,
    MolecularSystemComponent,
    PendingValidationComponent,
    LoadEntryComponent,
    ConfirmationDialogComponent,
    ContactUsComponent,
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
    MatMenuModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    LoadingPageModule,
    SlidingBarModule,
    MatDialogModule,
    MatRadioModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatAutocompleteModule
  ],
  bootstrap: [AppComponent],
  entryComponents: [ConfirmationDialogComponent]
})
export class AppModule {
}
