import { otziConsole } from './log.ts';

export class Recorder {
  private readonly CHANNEL_COUNT = 2;
  private readonly SAMPLE_RATE = 16000;

  private isRecording = false;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private currentDevice: MediaDeviceInfo | null = null;

  private readonly onStarted: RecorderOnStarted | null = null;
  private readonly onChunked: RecorderOnChunked | null = null;
  private readonly onStopped: RecorderOnStopped | null = null;

  constructor({ onStarted, onChunked, onStopped }: RecorderOptions = {}) {
    this.onStarted = onStarted || null;
    this.onChunked = onChunked || null;
    this.onStopped = onStopped || null;
  }

  async start(): Promise<StartResult> {
    if (this.isRecording) return { success: false, message: '录音已在进行中' };

    // 获取输入设备
    if (!this.currentDevice) {
      try {
        await this.setCurrentDevice();
      } catch (err) {
        otziConsole.log('xxxxxx', err);
        return { success: false, message: '' };
      }
    }

    // 获取多声道音频流
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(this.currentDevice && { deviceId: this.currentDevice.deviceId }),
        channelCount: this.CHANNEL_COUNT,
        sampleRate: this.SAMPLE_RATE,
        noiseSuppression: false,
        echoCancellation: false,
      },
    });

    // 创建 AudioContext，指定采样率
    this.audioContext = new AudioContext({
      sampleRate: this.SAMPLE_RATE,
      latencyHint: 'interactive',
    });

    // 创建音频分析器
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -95;
    analyser.maxDecibels = -35;

    otziConsole.info('AudioContext sampleRate:', this.audioContext.sampleRate);
    otziConsole.info(
      'Stream settings:',
      this.stream.getAudioTracks()[0].getSettings(),
    );

    // 创建音频源节点
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    // 连接音频源节点到分析器
    this.sourceNode.connect(analyser);
    // setWaveAnalyser(analyser);
    // setDataArray(new Uint8Array(analyser.frequencyBinCount));

    // 加载 AudioWorkletProcessor 脚本
    const blob = new Blob([this.getWorkletCode()], {
      type: 'application/javascript',
    });
    const workletUrl = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(workletUrl);

    // 创建 AudioWorkletNode
    this.audioWorkletNode = new AudioWorkletNode(
      this.audioContext,
      'recorder-processor',
      {
        processorOptions: {
          sampleRate: this.SAMPLE_RATE,
          channels: this.CHANNEL_COUNT,
        },
      },
    );

    // 收取 AudioWorklet 发送数据
    this.audioWorkletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(e.data)));
      this.onChunked?.(base64Data);
    };

    // 连接节点
    this.sourceNode.connect(this.audioWorkletNode);
    this.audioWorkletNode.connect(this.audioContext.destination);

    // 触发开始回调
    this.onStarted?.();

    this.isRecording = true;
    return { success: true };
  }

  async stop() {
    if (!this.isRecording) return;
    otziConsole.info('录音线程准备停止');

    // 停止所有音轨
    for (const mediaStreamTrack of this.stream?.getTracks() ?? []) {
      mediaStreamTrack.stop();
    }
    this.stream = null;
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.audioWorkletNode?.disconnect();
    this.audioWorkletNode = null;
    await this.audioContext?.close();
    this.audioContext = null;

    // waveAnalyser?.disconnect();

    // 触发停止回调
    this.onStopped?.();

    this.isRecording = false;
  }

  private async setCurrentDevice(): Promise<MediaDeviceInfo> {
    if (this.currentDevice) {
      otziConsole.info('当前已选择音频输入设备:', this.currentDevice);
      return Promise.resolve(this.currentDevice);
    }

    // 检查麦克风权限状态
    let permissionState = null;
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      otziConsole.info('麦克风权限状态:', status);
      permissionState = status.state;
    } catch (e) {
      // 某些浏览器可能不支持 Permissions API，此时直接 fallback
      otziConsole.warn('无法查询权限状态，直接尝试请求权限');
    }

    // 如果不是已授权状态，尝试请求权限
    if (permissionState !== 'granted') {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        otziConsole.error('当前无法访问麦克风，请检查浏览器权限设置');
        return Promise.reject('无法访问麦克风，请检查浏览器权限设置');
      }
    }

    // 枚举设备
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device) => device.kind === 'audioinput' && device.deviceId !== '',
    );
    otziConsole.info('可用的音频输入设备:', audioInputs);

    // 检查是否有可用的音频输入设备
    if (audioInputs.length === 0) {
      otziConsole.error('没有可用的音频输入设备');
      return Promise.reject('没有可用的音频输入设备');
    }

    // 只有一个音频输入设备，直接使用
    if (audioInputs.length === 1) {
      const device = audioInputs[0];
      otziConsole.info('只有一个音频输入设备，自动选择:', device);
      this.currentDevice = device;
      return Promise.resolve(device);
    }

    // 多个音频输入设备，先检查是否有默认设备
    const defaultDevice = audioInputs.find(
      (device) => device.deviceId === 'default',
    );
    if (defaultDevice) {
      otziConsole.info('找到默认音频输入设备:', defaultDevice);
      this.currentDevice = defaultDevice;
      return Promise.resolve(defaultDevice);
    }

    // 多个音频输入设备，没有默认设备时自动选择 deviceName 不为 'default' 或空的第一个设备
    const firstDevice = audioInputs.find(
      (device) => device.deviceId !== 'default' && device.deviceId !== '',
    );
    if (firstDevice) {
      otziConsole.info('自动选择第一个音频输入设备:', firstDevice);
      this.currentDevice = firstDevice;
      return Promise.resolve(firstDevice);
    }

    // 如果没有找到合适的设备，抛出错误
    return Promise.reject('没有找到合适的音频输入设备');
  }

  private getWorkletCode() {
    return `
    // const targetSampleRate = 16000 // 目标采样率
const targetFrameSize = 640 // 目标帧大小
const channelCount = 2 // 声道数

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.inputSampleRate = 44100 // 默认值，可根据需要调整
    this.bufferSize = targetFrameSize // 每次切片的帧数
    this.channelCount = channelCount // 声道数
    this.buffers = [[], []]

    this.port.onmessage = (e) => {
      if (e.data.event === 'config' && e.data.inputSampleRate) {
        this.inputSampleRate = e.data.inputSampleRate
        otziConsole.info('输入采样率设置为:', this.inputSampleRate)
      }
    }
  }

  process(inputs) {
    // inputs 为流的数组，每个流的数据为通道的数组，每个通道数组中的数据为 float32 浮点数
    if (inputs[0].length < this.channelCount) {
      // 输入通道数不足，跳过
      return true
    }

    const left = inputs[0][0]
    const right = inputs[0][1]

    this.buffers[0].push(...left)
    this.buffers[1].push(...right)

    // 当缓存达到 bufferSize，打包发送
    if (this.buffers[0].length >= this.bufferSize) {
      // 创建两个 Float32Array 通道数组
      const leftChannel = []
      const rightChannel = []

      // 拷贝数据到 Float32Array
      leftChannel.push(...this.buffers[0].slice(0, this.bufferSize))
      rightChannel.push(...this.buffers[1].slice(0, this.bufferSize))
      this.buffers[0] = this.buffers[0].slice(this.bufferSize)
      this.buffers[1] = this.buffers[1].slice(this.bufferSize)

      const frame1 = new Int16Array(leftChannel.length)
      const frame2 = new Int16Array(rightChannel.length)

      for (let i = 0; i < leftChannel.length; i++) {
        const sample = leftChannel[i]
        const s = Math.max(-1, Math.min(1, sample))
        frame1[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }
      for (let i = 0; i < rightChannel.length; i++) {
        const sample = rightChannel[i]
        const s = Math.max(-1, Math.min(1, sample))
        frame2[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      const data = new Int16Array(this.bufferSize * channelCount)
      for (let i = 0; i < frame1.length; i++) {
        data[i * 2] = frame1[i]
        data[i * 2 + 1] = frame2[i]
      }

      // 发送数据到主线程
      this.port.postMessage(data.buffer)
    }

    return true
  }
}

registerProcessor('recorder-processor', RecorderProcessor)
`;
  }

  get device() {
    return this.currentDevice;
  }
}
