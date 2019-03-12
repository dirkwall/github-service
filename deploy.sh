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
kubectl create secret generic -n keptn github-credentials --from-literal=org="$GITHUB_ORG" --from-literal=user="$GITHUB_USER" --from-literal=token="$GITHUB_API_TOKEN"

# Configuring outbound network access

gcloud container clusters describe ${CLUSTER_NAME} \
  --zone=${CLUSTER_ZONE} | grep -e clusterIpv4Cidr -e servicesIpv4Cidr

kubectl edit configmap config-network --namespace knative-serving

> Use an editor of your choice to change the 'istio.sidecar.includeOutboundIPRanges' parameter value from * to the IP range you need
