
let apiRoot = 'http://localhost:9000/deposition';
if (window.location.hostname.startsWith('dev.')) {
  apiRoot = '/deposition';
}

export const environment = {
  production: false,
  serverURL: apiRoot,
  contactEmail: 'help@bmrb.io',
  supportURL: 'https://nmrbox.zendesk.com/api/v2/requests.json'
};
