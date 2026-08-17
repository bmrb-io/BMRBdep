import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {SaveframeComponent} from './saveframe.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('SaveframeComponent', () => {
    let component: SaveframeComponent;
    let fixture: ComponentFixture<SaveframeComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [SaveframeComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(SaveframeComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
