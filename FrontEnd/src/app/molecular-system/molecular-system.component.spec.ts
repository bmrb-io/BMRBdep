import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {MolecularSystemComponent} from './molecular-system.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('MolecularSystemComponent', () => {
    let component: MolecularSystemComponent;
    let fixture: ComponentFixture<MolecularSystemComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [MolecularSystemComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(MolecularSystemComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
