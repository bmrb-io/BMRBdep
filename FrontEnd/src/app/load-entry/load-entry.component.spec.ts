import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadEntryComponent } from './load-entry.component';

describe('LoadEntryComponent', () => {
  let component: LoadEntryComponent;
  let fixture: ComponentFixture<LoadEntryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LoadEntryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LoadEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
