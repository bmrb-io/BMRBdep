#!/usr/bin/env python3

import requests
from bmrbdep import configuration

url = 'https://pub.orcid.org/oauth/token'

r = requests.post(url, data={'client_id': configuration['orcid']['client_id'],
                             'client_secret': configuration['orcid']['client_secret'],
                             'grant_type': 'client_credentials',
                             'scope': '/read-public'})

print('bearer: %s' % r.json()['access_token'])
print('refresh_token: %s' % r.json()['refresh_token'])
