import {inject, TestBed} from '@angular/core/testing';

import {MessagesService} from './messages.service';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('MessagesService', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [MessagesService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        });
    });

    it('should be created', inject([MessagesService], (service: MessagesService) => {
        expect(service).toBeTruthy();
    }));
});
