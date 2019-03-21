import { K8sClientFactory } from './K8sClientFactory';
import { K8sServiceInfo } from '../types/K8sServiceInfo';

const fs = require('fs');

class Utils {
  readFileContent(filePath: string) {
    return String(fs.readFileSync(filePath));
  }

  logMessage(keptnContext: string, message: string) {
    console.log(JSON.stringify({ 
      keptnContext: keptnContext,
      keptnService: 'github-service',
      logLevel: 'INFO',
      message: message,
    }));
  }

  async getK8sServiceUrl(serviceName, namespace): Promise<K8sServiceInfo> {
    const k8sClient = new K8sClientFactory().createK8sClient();
    const service =
      await k8sClient.api.v1.namespace(namespace).service(serviceName).get();

      return service as K8sServiceInfo;
  }
}

export { Utils };
