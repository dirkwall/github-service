apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: {{ application }}-{{ environment }}-{{ serviceName }}
spec:
  hosts:
  - "{{ serviceName }}.{{ environment }}.{{ ingressGatewayIP }}.xip.io"
  gateways:
  - {{ application }}-{{ environment }}-gateway
  http:
    - route:
      - destination:
          host: {{ serviceName }}.{{ environment }}.svc.cluster.local
