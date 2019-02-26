#!/bin/sh
REGISTRY_URI=$1
GITHUB_ORG=$2
GITHUB_USER=$3
GITHUB_API_TOKEN=$4

# Deploy operator
rm -f config/gen/operator.yaml

cat config/operator.yaml | \
  sed 's~REGISTRY_URI_PLACEHOLDER~'"$REGISTRY_URI"'~' >> config/gen/operator.yaml

kubectl apply -f config/gen/operator.yaml

# Create secret for USER and API_TOKEN

kubectl create secret generic -n keptn github-credentials --from-literal=user="$GITHUB_ORG" --from-literal=user="$GITHUB_USER" --from-literal=token="$GITHUB_API_TOKEN"
