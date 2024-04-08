import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

// Our components
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {WelcomeComponent} from './welcome/welcome.component';
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
import {LoopViewComponent} from './view_mode/loop/loop-view.component';
import {SaveframeViewComponent} from './view_mode/saveframe/saveframe-view.component';
import {RestoreComponent} from './restore/restore.component'; // Saving/loading bar
import {SupportComponent} from './support/support-component';

// From https://github.com/aitboudad/ngx-loading-bar
import {LoadingBarHttpClientModule} from '@ngx-loading-bar/http-client';

// Angular Material
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatLegacyButtonModule as MatButtonModule} from '@angular/material/legacy-button';
import {MatLegacyCardModule as MatCardModule} from '@angular/material/legacy-card';
import {MatLegacyDialogModule as MatDialogModule} from '@angular/material/legacy-dialog';
import {MatIconModule} from '@angular/material/icon';
import {MatLegacyInputModule as MatInputModule} from '@angular/material/legacy-input';
import {MatLegacyListModule as MatListModule} from '@angular/material/legacy-list';
import {MatLegacyMenuModule as MatMenuModule} from '@angular/material/legacy-menu';
import {MatLegacyProgressBarModule as MatProgressBarModule} from '@angular/material/legacy-progress-bar';
import {MatLegacyRadioModule as MatRadioModule} from '@angular/material/legacy-radio';
import {MatLegacySelectModule as MatSelectModule} from '@angular/material/legacy-select';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatLegacySlideToggleModule as MatSlideToggleModule} from '@angular/material/legacy-slide-toggle';
import {MatLegacySnackBarModule as MatSnackBarModule} from '@angular/material/legacy-snack-bar';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatLegacyCheckboxModule as MatCheckboxModule} from '@angular/material/legacy-checkbox';
import {MatLegacyAutocompleteModule as MatAutocompleteModule} from '@angular/material/legacy-autocomplete';
import {SidenavService} from './sidenav.service';
import {MatLegacyTooltipModule as MatTooltipModule, MAT_LEGACY_TOOLTIP_DEFAULT_OPTIONS} from '@angular/material/legacy-tooltip';

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
        SupportComponent,
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
        LoadingBarHttpClientModule,
        MatDialogModule,
        MatRadioModule,
        MatCheckboxModule,
        MatAutocompleteModule,
        MatTooltipModule
    ],
    bootstrap: [AppComponent],
    providers: [SidenavService, {provide: MAT_LEGACY_TOOLTIP_DEFAULT_OPTIONS, useValue: {showDelay: 1250}}]
})
export class AppModule {
}
