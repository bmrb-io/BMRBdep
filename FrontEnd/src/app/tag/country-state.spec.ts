import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';

import {TagComponent} from './tag.component';
import {DepositionPersistenceService} from '../deposition-persistence.service';
import {Loop} from '../nmrstar/loop';
import {Entry} from '../nmrstar/entry';
import {Saveframe} from '../nmrstar/saveframe';
import {Schema} from '../nmrstar/schema';

/* Just enough schema to build a contact person loop. The interface type of these two tags comes
 * from the tag name rather than the schema, so the entries can stay generic. */
function buildContactLoop(country: string, state: string): Loop {
  const tagSchema = {
    'BMRB data type': 'any',
    'Regex': /^.*$/,
    'User full view': 'Y',
    'Sf pointer': 'N',
    'Nullable': true,
    'default value': '?',
  };
  const schema = {
    dataTypes: {any: '.*'},
    getTag: () => tagSchema,
    saveframeSchema: {Contact_person: {'ADIT replicable': false, mandatory_number: 1}},
  } as unknown as Schema;
  const entry = {schema: schema, refresh: () => undefined, enumerationTies: {}} as unknown as Entry;
  const saveframe = {parent: entry, tagPrefix: '_Contact_person', category: '_Contact_person'} as unknown as Saveframe;
  return new Loop('_Contact_person', ['Country', 'State_province'], [[country, state]], saveframe);
}

/* Stands in for one row of the contact person loop. */
@Component({
  standalone: true,
  imports: [TagComponent],
  template: `
    @for (tag of loop.data[0]; track tag) {
      <app-tag [tag]="tag"></app-tag>
    }`,
})
class ContactRowHost {
  loop!: Loop;
}

describe('Contact person country/state dropdowns', () => {
  let fixture: ComponentFixture<ContactRowHost>;
  let loop: Loop;

  async function render(country: string, state: string): Promise<void> {
    loop = buildContactLoop(country, state);
    fixture = TestBed.createComponent(ContactRowHost);
    fixture.componentInstance.loop = loop;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function select(which: 'country' | 'state'): HTMLSelectElement {
    const selects = fixture.nativeElement.querySelectorAll('select');
    return which === 'country' ? selects[0] : selects[1];
  }

  function optionsOf(which: 'country' | 'state'): string[] {
    return Array.from(select(which).options).map(option => option.textContent!.trim());
  }

  async function pick(which: 'country' | 'state', value: string): Promise<void> {
    const element = select(which);
    element.value = value;
    element.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactRowHost],
      providers: [
        provideNoopAnimations(),
        {provide: DepositionPersistenceService, useValue: {storeEntry: () => undefined}},
      ],
    }).compileComponents();
  });

  it('offers all 21 Swedish counties, including Uppsala', async () => {
    await render('Sweden', '');
    const options = optionsOf('state');
    expect(options[0]).toBe('Select State or Province');
    expect(options.length).toBe(22);
    expect(options).toContain('Uppsala');
    expect(options).toContain('Skåne');
  });

  it('selects a stored state on load', async () => {
    await render('Sweden', 'Uppsala');
    expect(loop.data[0][1].value).toBe('Uppsala');
    expect(select('country').value).toBe('Sweden');
    expect(select('state').value).toBe('Uppsala');
  });

  it('writes the picked state back to the tag', async () => {
    await render('Sweden', '');
    await pick('state', 'Uppsala');
    expect(loop.data[0][1].value).toBe('Uppsala');
  });

  it('lists the countries with the preferred ones first', async () => {
    await render('', '');
    expect(optionsOf('country').slice(0, 7)).toEqual(
      ['Select country', 'United States', 'United Kingdom', 'China', 'Japan', 'Australia', 'Mexico']);
    expect(optionsOf('country')).toContain('Sweden');
  });

  it('repopulates the states when the country changes, clearing a state that no longer applies', async () => {
    await render('Sweden', 'Uppsala');
    await pick('country', 'Norway');

    expect(loop.data[0][0].value).toBe('Norway');
    expect(loop.data[0][1].value).toBe('');
    const options = optionsOf('state');
    expect(options).toContain('Innlandet');
    expect(options).not.toContain('Uppsala');
    expect(select('state').value).toBe('');
  });

  it('keeps a state that is no longer in the list rather than dropping it', async () => {
    await render('Sweden', 'Skane');
    const options = optionsOf('state');
    expect(options).toContain('Skane');
    expect(options).toContain('Skåne');
    expect(select('state').value).toBe('Skane');
  });
});
