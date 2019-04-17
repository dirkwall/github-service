import { K8sClientFactory } from './K8sClientFactory';
import { K8sServiceInfo } from '../types/K8sServiceInfo';
import { LoggingService } from '../services/LoggingService';

const fs = require('fs');

class Utils {
  private static instance;

  private wsLogger: LoggingService;

  private constructor() {

  }

  static getInstance(): Utils {
    if (Utils.instance === undefined) {
      Utils.instance = new Utils();
    }
    return Utils.instance;
  }

  readFileContent(filePath: string) {
    return String(fs.readFileSync(filePath));
  }

  setWsLogger(wsLogger: LoggingService) {
    Utils.instance.wsLogger = wsLogger;
  }

  logInfoMessage(keptnContext: string, message: string, terminate: boolean = false) {
    const msg = JSON.stringify({
      keptnContext,
      message,
      keptnService: 'github-service',
      logLevel: 'INFO',
    });
    console.log(msg);

    if (this.wsLogger !== undefined) {
      this.wsLogger.logMessage(keptnContext, message, terminate);
    }
  }

  logErrorMessage(keptnContext: string, message: string, terminate: boolean = false) {
    const msg = JSON.stringify({
      keptnContext,
      message,
      keptnService: 'github-service',
      logLevel: 'ERROR',
    });
    console.log(msg);

    if (this.wsLogger !== undefined) {
      this.wsLogger.logMessage(keptnContext, message, terminate);
    }
  }

  async getK8sServiceUrl(serviceName, namespace): Promise<K8sServiceInfo> {
    const k8sClient = new K8sClientFactory().createK8sClient();
    const service =
      await k8sClient.api.v1.namespace(namespace).service(serviceName).get();

    return service as K8sServiceInfo;
  }
}

export { Utils };
