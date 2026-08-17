import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {TagComponent} from './tag.component';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {provideRouter} from '@angular/router';

describe('TagComponent', () => {
    let component: TagComponent;
    let fixture: ComponentFixture<TagComponent>;

    beforeEach(waitForAsync(() => {
        TestBed.configureTestingModule({
            imports: [TagComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        })
            .compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(TagComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
