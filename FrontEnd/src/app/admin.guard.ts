import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {map} from 'rxjs/operators';
import {AuthService} from './auth.service';

/**
 * Allows navigation to the admin section only when the current session belongs to a configured
 * administrator. This is a UX gate only — every admin API endpoint independently enforces the
 * same check on the backend, so a non-admin reaching the route by other means can do nothing.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAdmin().pipe(
    map(isAdmin => isAdmin ? true : router.createUrlTree(['/']))
  );
};
