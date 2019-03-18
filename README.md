# Keptn GitHub Service

This service is designed to interact with GitHub for various keptn tasks:
* Creating a project
* Onboarding a service to a project
* Listening to a new artefact event to update the reference to the new artifact in the service configuration.

## Install service <a id="install"></a>

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

## Uninstall service <a id="install"></a>

1. To uninstall the service, run the following command:

    ```console
    $ kubectl delete -f ./config/gen/service.yml
    ```
