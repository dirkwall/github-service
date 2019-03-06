import * as Api from 'kubernetes-client';

export class K8sClientFactory {

  constructor() {}

  createK8sClient(): Api.ApiRoot {
    const Client = Api.Client1_10;
    const config = Api.config;
    let k8sClient;

    if (process.env.NODE_ENV === 'production') {
      k8sClient = new Client({ config: config.getInCluster() });
    } else {
      k8sClient = new Client({ config: config.fromKubeconfig() });
    }

    return k8sClient;
  }
/*
  async execCmd(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, function(err, stdout, stderr) {
        if (err) {
          reject(stderr);
        }
          resolve(stdout);
      });
    });
  }

  async getK8sServiceUrl(serviceName, namespace) {
    let services  = await this.execCmd(`kubectl get svc -n ${namespace} -o json`);
    return new Promise((resolve, reject) => {
      services = JSON.parse(services);
      let service = services.items.filter(svc => svc.metadata.name === serviceName)[0];
      const httpPorts = service.spec.ports.filter(port => port.name === 'http');
      let port;
      if (httpPorts.length > 0) {
        port = httpPorts[0].port;
      }
      resolve({
        ip: service.status.loadBalancer.ingress[0].ip,
        port,
      });
    });
  }
*/
}
