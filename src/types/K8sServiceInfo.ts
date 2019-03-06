export interface K8sServiceInfo {
  statusCode: number;
  body: Body;
}

interface Body {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  spec: Spec;
  status: Status;
}

interface Status {
  loadBalancer: LoadBalancer;
}

interface LoadBalancer {
  ingress: Ingress[];
}

interface Ingress {
  ip: string;
}

interface Spec {
  ports: Port[];
  selector: Selector;
  clusterIP: string;
  type: string;
  sessionAffinity: string;
  externalTrafficPolicy: string;
}

interface Selector {
  app: string;
  istio: string;
}

interface Port {
  name: string;
  protocol: string;
  port: number;
  targetPort: number;
  nodePort: number;
}

interface Metadata {
  name: string;
  namespace: string;
  selfLink: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  labels: Labels;
  annotations: Annotations;
}

interface Annotations {
  'kubectl.kubernetes.io/last-applied-configuration': string;
}

interface Labels {
  app: string;
  chart: string;
  heritage: string;
  istio: string;
  release: string;
}
