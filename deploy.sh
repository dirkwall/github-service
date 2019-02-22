#!/bin/sh
REGISTRY_URI=$1

# Deploy operator
rm -f config/gen/operator.yaml

cat config/operator.yaml | \
  sed 's~REGISTRY_URI_PLACEHOLDER~'"$REGISTRY_URI"'~' >> config/gen/operator.yaml

kubectl apply -f config/gen/operator.yaml
