import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {DataViewerComponent} from './data-viewer.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('DataViewerComponent', () => {
    let component: DataViewerComponent;
    let fixture: ComponentFixture<DataViewerComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [DataViewerComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(DataViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
