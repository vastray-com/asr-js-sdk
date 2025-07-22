import { otziConsole } from './lib/log.ts';
import { Recorder } from './lib/recorder';
import { WSClient } from './lib/websocket';

let client: WSClient | null = null;
let recorder: Recorder | null = null;

let onStopped: ASROnStopped | null = null;

window.otziASR = {
  LOG: false,
  start: async (record_id,url, opts) => {
    if (!record_id.trim()|| !url.trim()) {
      otziConsole.error('缺少 record_id 或 url 参数');
      return Promise.reject(new Error('缺少 record_id 或 url 参数'));
    }

    // 如果已经有一个 WebSocket 客户端实例，先断开连接
    if (client) {
      client.disconnect();
    }

    // 创建新的 Recorder 实例
    recorder = new Recorder({
      onStarted: () => otziConsole.log('Recorder started'),
      onChunked: (data) =>
        client &&
        client.connectionState === WebSocket.OPEN &&
        client.send(JSON.stringify({ event: 'recording', data })),
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
    const wsUrl = `${url}?record_id=${record_id}&device_name=${recorder.device?.label ?? 'default'}&sep_roles=true`;

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
        switch (msg.event) {
          // ASR 结束
          case 'done':
            client?.disconnect();
            client = null;
            recorder = null;
            onStopped?.();
            return Promise.resolve();
          // ASR 识别结果
          case 'recognized':
            otziConsole.log('recognized: ', msg.data);
            opts?.onRecognized?.(msg.data);
            break;
          // ASR 问题提示
          case 'tips':
            otziConsole.log('tips:', msg.data);
            opts?.onTips?.(msg.data);
            break;
          // ASR 病历生成结果
          case 'medical_record':
            otziConsole.log('medical record: ', msg.data);
            opts?.onMedicalRecord?.(msg.data);
            break;
          // ASR 被停止消息
          case 'terminated':
            otziConsole.log('terminal:', msg.data);
            if (recorder) {
              recorder.stop();
            }
            client?.disconnect();
            client = null;
            recorder = null;
            opts?.onTerminated?.(msg.data);
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
      client &&
        client.connectionState === WebSocket.OPEN &&
        client.send(JSON.stringify({ event: 'stop' }));
      onStopped = cb || null;
    } else {
      otziConsole.warn('没有正在进行的录音');
      return Promise.reject();
    }
  },
};
