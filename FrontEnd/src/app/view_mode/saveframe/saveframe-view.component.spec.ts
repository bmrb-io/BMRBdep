import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import {SaveframeComponent} from '../../saveframe/saveframe.component';


describe('SaveframeComponent', () => {
  let component: SaveframeComponent;
  let fixture: ComponentFixture<SaveframeComponent>;

  beforeEach(waitForAsync(() => {
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
