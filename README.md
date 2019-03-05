# Keptn GitHub Service

This service is designed to interact with GitHub for various keptn tasks.

##### Table of Contents
 * [Install service](#install)
 * [Uninstall service](#install)

## Install service <a id="install"></a>

1. Go to `~/github-service`.

    ```console
    $ pwd
    ~/github-service
    ```

1. To install the service, run the `deploy.sh` script as shown below: 

    ```console
    $ ./deploy.sh <REGISTRY_URI> <GITHUB_API_TOKE>
    ```

1. To verify the installation, run the following `kubectl` command: 

    ```console
    $ kubectl get pods -n cicd
    NAME           STATUS    AGE
    ???
    ```

## Uninstall service <a id="install"></a>

1. To uninstall the service, run the following commands:

    ```console
    $ kubectl delete -f ./manifests/github/*
    ```