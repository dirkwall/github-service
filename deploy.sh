#!/bin/sh
REGISTRY_URI=$1
GITHUB_ORG=$2
GITHUB_USER=$3
GITHUB_API_TOKEN=$4

# Deploy service
rm -f config/gen/service.yaml

cat config/service.yaml | \
  sed 's~REGISTRY_URI_PLACEHOLDER~'"$REGISTRY_URI"'~' >> config/gen/service.yaml

kubectl apply -f config/gen/service.yaml

# Create secret for USER and API_TOKEN
kubectl create secret generic -n keptn github-credentials --from-literal=gitorg="$GITHUB_ORG" --from-literal=gituser="$GITHUB_USER" --from-literal=gittoken="$GITHUB_API_TOKEN"
