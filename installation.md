# BMRBDep installation

A basic installation of the BMRBdep server is very straightforward. These are the steps:

### Development/debugging environment

1. Ensure that you have [docker](https://www.docker.com/) installed and running on the server you will
 use to host BMRBdep. Ensure that you also have the `venv` and `pip` python modules installed on your
  system. On a package that uses the apt package manager, `sudo apt install python3-venv python3-pip`
  should install these dependencies. For a system that uses the yum package manager,
  `yum install python3-virtualenv python3-pip` should  install these dependencies.
2. Navigate to the folder where you want the BMRBdep server files to exist, and run
 `git clone https://github.com/uwbmrb/BMRBdep.git` and then `cd BMRBdep`.
3. Set up the local environment (create virtual environments for the server and create a
 default configuration file) by running `./install.sh`
4. Update the configuration file located at `BackEnd/bmrbdep/configuration.json` to have the appropriate values.
   * Mandatory sections to update
     * `repo_path` variable which will define where depositions are stored on disk
     * `secret_key` must be set to a randomly generated value. See instructions in the configuration file.
     Do not change this once the server is live for production, or existing validation e-mails will cease
     working!
     * `smtp` section
     * `ETS` section. Please use a 'test ETS' database while testing that the server is installed correctly.
   * Sections which you will need to update before production use
     * `orcid` - You can get an API key for the ORCID API [here](https://orcid.org/organizations/integrators/API).
   * Other notes
     * `local-ips` - This will cause the server to return a full stack trace rather than a basic error
      if your IP address is in the `local-ips` list. Only enter IPs for development machines,
      or end users may see stack traces. 
5. Build and launch a development environment docker container by running `./build_docker.sh`
6. If everything has went well, you should be able to connect to the server running the BMRBdep docker
container on port 9001. If you don't see the server running there, and there were not any command line
errors, check the docker error log using `sudo docker logs bmrbdep`.

### Upgrading to production

The main difference in production mode is that errors are not logged to the console, and the
experimental "small molecule" deposition type is hidden.

1. Follow all the steps above.
2. Change the `debug` value in the configuration file to `false`. This turns on e-mail validation.
3. Deploy docker by running `./build_docker.sh production` rather than `./build_docker.sh`.
(This will replace the previous docker instance from step 5 above.)


### Upgrading to a new release

To upgrade to a new release of BMRBdep, first cd to the root BMRBdep directory and then run the following:

```python
git pull
cd FrontEnd
source node_env/bin/activate
npm install
deactivate_node
```

If you are running in production more (or in the development Docker mode) you must then run

```python
./build_docker.sh
```

for a development mode container or

```python
./build_docker.sh production
```

for a production mode container

in the root BMRBdep directory.