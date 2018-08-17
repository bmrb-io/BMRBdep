# Development Timeline: 

Uncompleted tasks:

* Web Interface
    * Allow starting a session from an existing NMR-STAR file
        * Update PyNMRSTAR to allow "merging" entries - 2 days
        * Add new methods to API - 1 day
        * Update GUI - 1 day
    * Write code to "submit" deposition into existing pipeline 2-3 days
    * ORCID
        * Implement ORCID validation using OpenAuth flow - ~1 week
    * Smaller tasks
        * At least one PI is needed in contact person - 1 day
        * Implement smarter new saveframe names - 4 hours
        * Only allow one outstanding save request at a time - 4 hours
    * Data file uploading
        * Add functionality to upload files to GUI - 2 days
        * Trigger display/addition of data-related saveframes upon upload - 2 days
    * Add more thorough error handling everywhere - 1 week

* Validation Tools
    * Write tool to print dictionary diffs - 4 hours
    * Write protractor tests for GUI - 2 days
    * Write more dictionary sanity-checks - 1 day
     
* Infrastructure
    * Configure new API server cluster - 1-2 days
    * (Maybe) Update API and BMRBDep servers to run inside of docker - 1-2 weeks 

<b>Targeted first beta completion: September 26th.</b>
