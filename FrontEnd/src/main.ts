import {enableProdMode, importProvidersFrom, provideZoneChangeDetection} from '@angular/core';


import {environment} from './environments/environment';
import {SidenavService} from './app/sidenav.service';
import {MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipModule} from '@angular/material/tooltip';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {bootstrapApplication, BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AppRoutingModule} from './app/app-routing.module';
import {provideAnimations} from '@angular/platform-browser/animations';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {LoadingBarHttpClientModule} from '@ngx-loading-bar/http-client';
import {MatDialogModule} from '@angular/material/dialog';
import {MatRadioModule} from '@angular/material/radio';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatLineModule} from '@angular/material/core';
import {AppComponent} from './app/app.component';

if (environment.production) {
  enableProdMode();

  const disabledFunction = () => 'Console has been disabled in production mode.';
  console.log = disabledFunction;
  console.warn = disabledFunction;
  // Don't disable errors, just logs and warnings
  // console.error = disFunc;

  Object.freeze(console);
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    importProvidersFrom(BrowserModule, FormsModule, AppRoutingModule, ReactiveFormsModule, MatProgressBarModule, MatSelectModule, MatSlideToggleModule, MatSidenavModule, MatInputModule, MatListModule, MatToolbarModule, MatIconModule, MatMenuModule, MatCardModule, MatButtonModule, MatSnackBarModule, LoadingBarHttpClientModule, MatDialogModule, MatRadioModule, MatCheckboxModule, MatAutocompleteModule, MatTooltipModule, MatLineModule),
    SidenavService, {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {showDelay: 1750, position: 'right'}
    }, provideHttpClient(withInterceptorsFromDi()),
    provideAnimations()
  ]
})
  .catch(err => console.log(err));

