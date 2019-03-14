apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: {{ serviceName }}-{{ environment }}-destination
spec:
  host: {{ serviceName }}.{{ environment }}.svc.cluster.local
  subsets:
  - name: blue
    labels:
      deployment: {{ serviceName }}-blue
  - name: green
    labels:
      deployment: {{ serviceName }}-green