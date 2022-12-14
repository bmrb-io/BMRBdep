import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MolecularSystemComponent } from './molecular-system.component';

describe('MolecularSystemComponent', () => {
  let component: MolecularSystemComponent;
  let fixture: ComponentFixture<MolecularSystemComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MolecularSystemComponent ]
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
