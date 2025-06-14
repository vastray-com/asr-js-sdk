import { APP_ENV } from './constant';
import { otziConsole } from './lib/log.ts';
import { Recorder } from './lib/recorder';
import { WSClient } from './lib/websocket';

let client: WSClient | null = null;
let recorder: Recorder | null = null;

let onStopped: ASROnStopped | null = null;

window.otziASR = {
  LOG: true,
  start: async (record_id, opts) => {
    if (!record_id) {
      otziConsole.error('缺少 record_id 参数');
      return Promise.reject(new Error('缺少 record_id 参数'));
    }

    // 如果已经有一个 WebSocket 客户端实例，先断开连接
    if (client) {
      client.disconnect();
    }

    // 创建新的 Recorder 实例
    recorder = new Recorder({
      onStarted: () => otziConsole.log('Recorder started'),
      onChunked: (data) =>
        client?.send(JSON.stringify({ event: 'recording', data })),
    });

    // 尝试启动录音
    try {
      await recorder?.start();
    } catch (e) {
      otziConsole.error('Recorder start failed:', e);
      recorder = null;
      return Promise.reject();
    }

    // 构造 WebSocket URL
    const wsUrl = `${APP_ENV.ASR_URL}?record_id=${record_id}&device_name=${recorder.device?.label ?? 'default'}&sep_roles=false`;

    client = new WSClient(wsUrl, {
      onopen: () => {
        opts?.onStarted?.();
        Promise.resolve();
      },
      onclose: () => {
        if (recorder) {
          recorder.stop();
        }
      },
      onmessage: (message: string) => {
        const msg = JSON.parse(message) as WSMessage;
        otziConsole.info('WebSocket 收到消息:', msg);
        if (msg.event === 'recognized') {
          otziConsole.log('received', msg.data);
          opts?.onReceived?.(msg.data);
        } else if (msg.event === 'done') {
          client?.disconnect();
          client = null;
          recorder = null;
          onStopped?.();
          return Promise.resolve();
        }
      },
    });

    // 启动 WebSocket 连接
    client.connect();
  },
  stop: async (cb) => {
    if (recorder) {
      await recorder.stop();
      client?.send(JSON.stringify({ event: 'stop' }));
      onStopped = cb || null;
    } else {
      otziConsole.warn('没有正在进行的录音');
      return Promise.reject();
    }
  },
};
