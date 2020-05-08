#!/usr/bin/env python3

import os
import requests
import webbrowser

# First make a request to create a deposition
deposition_info = {'email': 'wedell@bmrb.wisc.edu',
                   'orcid': '0000-0002-2247-6259',
                   'deposition_nickname': 'test deposition'}
r = requests.post("https://bmrbig.org/deposition/new", data=deposition_info)
r.raise_for_status()

# This is the unique ID assigned to your BMRbig session. In production, I think
# it would be prudent to store this internally somewhere for later reference.
deposition_id = r.json()['deposition_id']

# Now we will upload a file
script_dir = os.path.dirname(os.path.realpath(__file__))
file_path = os.path.join(script_dir, 'demo file.tgz')
files = {'file': open(file_path, 'rb')}
r = requests.post(f"https://bmrbig.org/deposition/{deposition_id}/file", files=files)
r.raise_for_status()

# The server might have renamed the file, so get the "cleaned" name
print(f"File name on server is: {r.json()['filename']}")

# Note that the json response contains two other fields that I don't believe you need to use at this point:
# "changed" will indicate if your file upload changed anything. This will be false if the same file
#           exists on the server already with the same name
# "commit" will show the most recent Git commit within the upload session. (Each change is committed to a local git
# repo.)

# At this point you could upload additional files (you could tar each experiment separately) or any other files
#  that are relevant to the deposition. (Such as a LOGS metadata file.)

# Finally, you will open the bmrbig.org page in a new browser tab for the user to review and complete the deposition
webbrowser.open(f"http://bmrbig.org/entry/load/{deposition_id}")
