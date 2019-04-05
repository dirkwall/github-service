#!/bin/sh
# Create secret for ORG, USER, TOKEN
kubectl create secret generic -n keptn github-credentials --from-literal=org=githuborg --from-literal=user=githubuser --from-literal=token=token

kubectl delete -f config/service.yaml --ignore-not-found
kubectl apply -f config/service.yaml
