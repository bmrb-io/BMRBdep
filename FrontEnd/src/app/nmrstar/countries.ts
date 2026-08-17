import {allCountries} from 'country-region-data';

/* The countries listed at the top of the country dropdown, in this order. */
const preferredCountryCodes = ['US', 'GB', 'CN', 'JP', 'AU', 'MX'];

function alphabetically(a: string, b: string): number {
    return a.localeCompare(b);
}

const regionsByCountry = new Map<string, string[]>(
    allCountries.map(([countryName, , regions]) =>
        [countryName, regions.map(region => region[0]).sort(alphabetically)] as [string, string[]])
);

/* The country names to offer, with the preferred countries first and the rest alphabetical. */
export const countryNames: string[] = preferredCountryCodes
    .map(code => allCountries.filter(country => country[1] === code)[0][0])
    .concat(allCountries
        .filter(country => preferredCountryCodes.indexOf(country[1]) < 0)
        .map(country => country[0])
        .sort(alphabetically));

/* Shared so that countries without regions always yield the same array instance. */
const noRegions: string[] = [];

/* The states/provinces/regions of a country, alphabetically. Unknown countries have none. */
export function getRegions(countryName: string): string[] {
    const regions = regionsByCountry.get(countryName);
    return regions ? regions : noRegions;
}
