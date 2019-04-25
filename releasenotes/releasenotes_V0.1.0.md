# Release Notes 0.1.0

## Release Goal

This service is designed to allow keptn the implementation of the GitOps approach. To take full advantage of this approach, keptn relies on functionality such as creating the repository, adding configuration files, and changing these files. This functionality is implemented in this initial release and can be distinguished into three groups:
1. Configuration of the github-service
1. Creating a project and onboarding a service
1. Maintaining configuration changes

To trigger these functionalities, the service listens to CloudEvents from type:
* `configure`: When receiving this event, the service updates the secret *github-credentials* and stores key-value pairs for the GitHub organization (org), the GitHub user (user) and the user's personal access token (token).
* `create.project`: When receiving this event, a project (aka GitHub repository) will be created according to a *shipyard.yaml* file. 
* `onboard.service`: When receiving this event, the service onboard a service to the corresponding project.
* `sh.keptn.events.new-artefact`: When receiving this event, the service updates the configuration of the service in the particular stage.
