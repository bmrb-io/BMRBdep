import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveframeTagComponent } from './saveframe-tag.component';

describe('SaveframeTagComponent', () => {
  let component: SaveframeTagComponent;
  let fixture: ComponentFixture<SaveframeTagComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SaveframeTagComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SaveframeTagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
