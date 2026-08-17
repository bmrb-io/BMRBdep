import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {ConfirmationDialogComponent} from './confirmation-dialog.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';
import {MatDialogRef} from '@angular/material/dialog';

describe('ConfirmationDialogComponent', () => {
    let component: ConfirmationDialogComponent;
    let fixture: ComponentFixture<ConfirmationDialogComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [ConfirmationDialogComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
                {provide: MatDialogRef, useValue: {close: () => undefined}}]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(ConfirmationDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
