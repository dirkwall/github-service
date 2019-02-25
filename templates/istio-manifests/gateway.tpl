apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: {{ application }}-{{ stage }}-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "*"