import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

if (environment.production) {
  enableProdMode();

  const disabledFunction = () => 'Console has been disabled in production mode.';
  console.log = disabledFunction;
  console.warn = disabledFunction;
  // Don't disable errors, just logs and warnings
  // console.error = disFunc;

  Object.freeze(console);
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));

