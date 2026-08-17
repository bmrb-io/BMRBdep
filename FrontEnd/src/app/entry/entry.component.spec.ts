import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {EntryComponent} from './entry.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('EntryComponent', () => {
    let component: EntryComponent;
    let fixture: ComponentFixture<EntryComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [EntryComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(EntryComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
