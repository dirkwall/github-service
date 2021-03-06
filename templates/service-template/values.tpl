replicaCount: 1
image:
    repository: null
    tag: null
    pullPolicy: IfNotPresent
service:
    name: {{ serviceName }}
    type: LoadBalancer
    externalPort: 80
    internalPort: 8080
container:
    name: {{ serviceName }}
resources:
    limits:
        cpu: 100m
        memory: 128Mi
    requests:
        cpu: 100m
        memory: 128Mi