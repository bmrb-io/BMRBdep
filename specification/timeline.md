# Development Timeline: 

Uncompleted tasks:

* Web Interface
    * Allow starting a session from an existing NMR-STAR file
        * Update PyNMRSTAR to allow "merging" entries - 2 days
        * Add new methods to API - 1 day
        * Update GUI - 1 day
        * Handle incompatible dictionary changes in uploaded files - ??? days
    * Write code to "submit" deposition into existing pipeline 2-3 days
    * ORCID
        * Implement ORCID validation using OpenAuth flow - ~1 week
    * Smaller tasks
        * Only allow one outstanding save request at a time - 4 hours
    * Add more thorough error handling everywhere - 1 week
    * Add some sort of session support to prevent simultaneous 
    browser changes and potential data loss - 2 days
    * Navigation bar updates
      * Redo bar to use Angular Material navigation elements - 2 days
      * Add supercategory-level navigation (also requires API update)- 3 days
    * Either prevent unicode or warn about it during tag validation - 1 day
Optimization tasks:
* Implement saving on a saveframe-level basis to speed up saving smaller changes - 3 days
* Use a fixed position icon to indicate save status rather than having a pop-up
* Consider a warning before deleting a saveframe that would invalidate another one

* Validation Tools
    * Write tool to print dictionary diffs - 1 day
    * Write protractor tests for GUI - 2 days
    * Write more dictionary sanity-checks - 1 day
     
* Infrastructure
    * Configure new API server cluster - 1-2 days
    * (Maybe) Update API and BMRBDep servers to run inside of docker - 1-2 weeks 

<b>Targeted first beta completion: September 26th.</b>
