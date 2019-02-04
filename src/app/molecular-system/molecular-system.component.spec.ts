import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MolecularSystemComponent } from './molecular-system.component';

describe('MolecularSystemComponent', () => {
  let component: MolecularSystemComponent;
  let fixture: ComponentFixture<MolecularSystemComponent>;

  beforeEach(async(() => {
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
