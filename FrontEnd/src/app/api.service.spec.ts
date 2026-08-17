import {inject, TestBed} from '@angular/core/testing';

import {ApiService} from './api.service';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('ApiService', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [ApiService, provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        });
    });

    it('should be created', inject([ApiService], (service: ApiService) => {
        expect(service).toBeTruthy();
    }));
});
