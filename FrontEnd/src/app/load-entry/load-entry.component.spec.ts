import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {LoadEntryComponent} from './load-entry.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('LoadEntryComponent', () => {
    let component: LoadEntryComponent;
    let fixture: ComponentFixture<LoadEntryComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [LoadEntryComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(LoadEntryComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
