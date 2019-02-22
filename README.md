# Keptn GitHub Operator

This operator is designed to interact with GitHub for various keptn tasks.

##### Table of Contents
 * [Install operator](#install)
 * [Uninstall operator](#install)

## Install operator <a id="install"></a>

1. Go to `~/github-operator`.

    ```console
    $ pwd
    ~/github-operator
    ```

1. To install the operator, execute the `kubectl apply -f ./manifests/operator/*` command: 

    ```console
    $ kubectl apply -f ./manifests/operator/*
    ```

1. To verify the installation, run the following `kubectl` command: 

    ```console
    $ kubectl get pods -n cicd
    NAME           STATUS    AGE
    ???
    ```

## Uninstall operator <a id="install"></a>

1. To uninstall the operator, run the following commands:

    ```console
    $ kubectl delete -f ./manifests/github/*
    ```