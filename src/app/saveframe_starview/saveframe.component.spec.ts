import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveframeComponent } from './saveframe.component';

describe('SaveframeComponent', () => {
  let component: SaveframeComponent;
  let fixture: ComponentFixture<SaveframeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SaveframeComponent ]
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
