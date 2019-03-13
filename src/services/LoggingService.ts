import { WebSocketChannelInfo } from '../types/WebSocketChannelInfo';
import { KeptnRequestModel } from '../types/KeptnRequestModel';

const WebSocket = require('ws');

export class LoggingService {

  private webSocket: any;

  constructor() {

  }

  connect(webSocketChannelInfo: WebSocketChannelInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      let serverUrl;
      if (process.env.NODE_ENV === 'production') {
        serverUrl = 'ws://control.keptn.svc.cluster.local';
      } else {
        serverUrl = 'ws://control-websocket.keptn.35.222.202.204.xip.io';
      }
      this.webSocket = new WebSocket(serverUrl, {
        headers: {
          token: webSocketChannelInfo.token,
        },
      });
      this.webSocket.on('open', () => {
        console.log('connected');
        resolve();
      });
    });
  }

  logMessage(message: string, terminate: boolean): void {
    if (this.webSocket !== undefined) {
      const logEvent = new KeptnRequestModel();
      logEvent.type = KeptnRequestModel.EVENT_TYPES.LOG;
      logEvent.data = {
        message,
        terminate,
      };
      this.webSocket.send(JSON.stringify(logEvent));
    }
  }
}
