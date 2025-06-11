import { APP_ENV } from './constant.ts';
import { ASRClient } from './websocket.ts';

const client = new ASRClient(APP_ENV.ASR_URL, {
  onopen: () => {
    client.send('Hello ASR Service');
    client.disconnect();
  },
});

client.connect();
