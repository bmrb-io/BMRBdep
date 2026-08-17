import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {RestoreComponent} from './restore.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('RestoreComponent', () => {
    let component: RestoreComponent;
    let fixture: ComponentFixture<RestoreComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [RestoreComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(RestoreComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
