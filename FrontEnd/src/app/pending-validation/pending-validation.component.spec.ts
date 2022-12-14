import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PendingValidationComponent } from './pending-validation.component';

describe('PendingValidationComponent', () => {
  let component: PendingValidationComponent;
  let fixture: ComponentFixture<PendingValidationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PendingValidationComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PendingValidationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
