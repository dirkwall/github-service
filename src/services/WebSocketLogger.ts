import { WebSocketChannelInfo } from '../types/WebSocketChannelInfo';
import { KeptnRequestModel } from '../types/KeptnRequestModel';

const WebSocket = require('ws');

export class WebSocketLogger {
  private webSocket: any;

  constructor() {

  }

  connect(webSocketChannelInfo: WebSocketChannelInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      let serverUrl;
      if (process.env.NODE_ENV === 'production') {
        serverUrl = 'ws://control.keptn.svc.cluster.local';
      } else {
        serverUrl = 'ws://control.keptn.35.222.202.204.xip.io';
      }
      console.log('[github-service]: Start to connect to websocket')
      this.webSocket = new WebSocket(serverUrl, {
        headers: {
          token: webSocketChannelInfo.token,
        },
      });
      this.webSocket.on('open', () => {
        console.log('[github-service]: Connected to websocket');
        resolve();
      });
    });
  }

  logMessage(
    keptnContext: string,
    message: string,
    logLevel: string = 'INFO',
    terminate: boolean = false): void {
    if (this.webSocket !== undefined) {
      const logEvent = new KeptnRequestModel();
      logEvent.type = KeptnRequestModel.EVENT_TYPES.LOG;
      logEvent.shkeptncontext = keptnContext;
      logEvent.data = {
        message,
        terminate,
        logLevel,
      };
      this.webSocket.send(JSON.stringify(logEvent));
    }
  }

  closeConnection() {
    this.webSocket.terminate();
  }
}
