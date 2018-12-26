import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LoopViewComponent } from './loop-view.component';

describe('LoopViewComponent', () => {
  let component: LoopViewComponent;
  let fixture: ComponentFixture<LoopViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LoopViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LoopViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
