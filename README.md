# Keptn GitHub Service

This service is designed to allow keptn the implementation of the GitOps approach, which is one of keptn's core principles. The GitOps approach has become a best practice for managing applications and the whole Cloud-native stack by using Git as the source of truth. In other words, the configurations of the applications and the environment are maintained within a Git repository and always represents the desired state of the target environment (e.g., your Kubernetes cluster). To take full advantage of this approach, keptn relies on functionality such as creating the repository, adding configuration files, and changing these files. This functionality is implemented in this service and can be distinguished into three groups explained below:
1. Configuration of the service
1. Creating a project and onboarding a service
1. Maintaining configuration changes

From a technical perspective, the service is implemented in TypeScript on top of the Express framework. On the POST endpoint, the service receives requests that need to contain a valid CloudEvent in their body. The following list of CloudEvent types are supported by the service:
* *configure*
* *create.project*
* *onboard.service*
* *sh.keptn.events.new-artefact*

## Secret for credentials

To store credentials that are used by the github service to authorize against the GitHub API, a secret is used. The name of the secret is `github-credentials` and it stores key-value pairs for the GitHub organization (org), the GitHub user (user) and the user's personal access token (token). When installing the service, the secret holds default values for these three key-value pairs:
* org=githuborg 
* user=githubuser
* token=token

## Configuration of the service

To configure the github service, the service listens to a CloudEvent from type `configure`. When receiving this event, the service updates the secret by setting the GitHub organization, GitHub user, and the user's personal access token based on the event payload.

## Creating a project and onboarding a service

To get started with the GitOps approach, the service provides the functionality to create a GitHub repository (aka. keptn project) and to add the configuration of an application to this repository.

#### Create project
To create a GitHub repository (aka. keptn project), the service listens to a CloudEvent from type `create.project`. This event defines the name of the repository and is supposed to contain a *shipyard* file. This shipyard file  specifies the stages in case of multi-stage environment; typically, a project has a dev, staging, and production stage. Based on the name, the github service creates the repository and it creates a branch for each stage according to the *shipyard*. 

#### Onboard service
To onboard a service to a keptn project (i.e., to add a service's configuration to the corresponding GitHub repository), the service listens to a CloudEvent from type `onboard.service`. In the current implementation, the service configuration can be handed over in two ways: 
1. The event contains just the values of a Helm chart. In this case, a default template for the deployment and service definition of the service are used. 
1. The event contains the values of a Helm chart as well as the deployment and service definition of the service. 

After extracting the configuration from the event payload, the functionality takes care of adding it to each stage (i.e., branch) of the project. For instance, the configuration will be added to the *dev*, *staging*, and *production* branch in case of a three-staged environment.

## Maintaining configuration changes
Regularly maintaining configuration changes means that the service listens to CloudEvents from type `sh.keptn.events.new-artefact`. This event contains the entire information for updating the configuration of a service in a particular stage. After a successful update, the service sends out a CloudEvent from type `sh.keptn.events.configuration-changed`.

## Install service

1. To install the service, run the `deploy.sh` script as shown below: 

    ```console
    $ ./deploy.sh
    ```

1. To verify the installation, run the following `kubectl` commands: 

    ```console
    $ kubectl get ksvc -n keptn
    NAME                 AGE
    ...
    github-service       1m
    ...
    ```

    ```console
    $ kubectl get pods -n keptn
    NAME                                                  READY     STATUS      RESTARTS   AGE
    ...
    github-service-4vhsh-deployment-58c8cf65fd-qrjp9      3/3       Running     0          1m
    ...
    ```

## Uninstall service

1. To uninstall the service, run the following `kubectl` command:

    ```console
    $ kubectl delete -f ./config/gen/service.yml
    ```
