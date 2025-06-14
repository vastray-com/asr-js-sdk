// const targetSampleRate = 16000 // 目标采样率
import { otziConsole } from 'src/lib/log.js';

const targetFrameSize = 640; // 目标帧大小
const channelCount = 2; // 声道数

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputSampleRate = 44100; // 默认值，可根据需要调整
    this.bufferSize = targetFrameSize; // 每次切片的帧数
    this.channelCount = channelCount; // 声道数
    this.buffers = [[], []];

    this.port.onmessage = (e) => {
      if (e.data.event === 'config' && e.data.inputSampleRate) {
        this.inputSampleRate = e.data.inputSampleRate;
        otziConsole.info('输入采样率设置为:', this.inputSampleRate);
      }
    };
  }

  process(inputs) {
    // inputs 为流的数组，每个流的数据为通道的数组，每个通道数组中的数据为 float32 浮点数
    if (inputs[0].length < this.channelCount) {
      // 输入通道数不足，跳过
      return true;
    }

    const left = inputs[0][0];
    const right = inputs[0][1];

    this.buffers[0].push(...left);
    this.buffers[1].push(...right);

    // 当缓存达到 bufferSize，打包发送
    if (this.buffers[0].length >= this.bufferSize) {
      // 创建两个 Float32Array 通道数组
      const leftChannel = [];
      const rightChannel = [];

      // 拷贝数据到 Float32Array
      leftChannel.push(...this.buffers[0].slice(0, this.bufferSize));
      rightChannel.push(...this.buffers[1].slice(0, this.bufferSize));
      this.buffers[0] = this.buffers[0].slice(this.bufferSize);
      this.buffers[1] = this.buffers[1].slice(this.bufferSize);

      const frame1 = new Int16Array(leftChannel.length);
      const frame2 = new Int16Array(rightChannel.length);

      for (let i = 0; i < leftChannel.length; i++) {
        const sample = leftChannel[i];
        const s = Math.max(-1, Math.min(1, sample));
        frame1[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      for (let i = 0; i < rightChannel.length; i++) {
        const sample = rightChannel[i];
        const s = Math.max(-1, Math.min(1, sample));
        frame2[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const data = new Int16Array(this.bufferSize * channelCount);
      for (let i = 0; i < frame1.length; i++) {
        data[i * 2] = frame1[i];
        data[i * 2 + 1] = frame2[i];
      }

      // 发送数据到主线程
      this.port.postMessage(data.buffer);
    }

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
