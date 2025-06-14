import { otziConsole } from './log.ts';

export type WebSocketOptions = {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  binaryType?: BinaryType;
  onopen?: FN;
  onclose?: FN;
  onerror?: (error: string) => void;
  onmessage?: (data: string) => void;
};

export class WSClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectInterval: number;
  private readonly endpoint: string;
  private readonly binaryType: BinaryType;
  private isActive = false;

  // 回调函数，用于接收识别结果
  private readonly onSocketOpen: FN | null = null;
  private readonly onSocketClose: FN | null = null;
  private readonly onSocketError: ((error: string) => void) | null = null;
  private readonly onSocketMessage: ((data: string) => void) | null = null;

  constructor(endpoint: string, options: WebSocketOptions = {}) {
    this.endpoint = endpoint;
    this.maxReconnectAttempts = options.reconnectAttempts ?? 3;
    this.reconnectInterval = options.reconnectInterval ?? 400;
    this.binaryType = options.binaryType ?? 'arraybuffer';
    this.onSocketOpen = options.onopen ?? null;
    this.onSocketClose = options.onclose ?? null;
    this.onSocketError = options.onerror ?? null;
    this.onSocketMessage = options.onmessage ?? null;
  }

  connect(): void {
    try {
      this.socket = new WebSocket(this.endpoint);
      this.socket.binaryType = this.binaryType;

      // 设置 WebSocket 事件处理
      this.socket.onopen = () => {
        this.reconnectAttempts = 0; // 重置重连计数
        otziConsole.log('已连接到 WebSocket:', this.endpoint);

        this.onSocketOpen?.();
      };

      this.socket.onclose = (event: CloseEvent) => {
        // 主动关闭的情况
        if (!this.isActive) {
          otziConsole.log('WebSocket 已主动关闭');
          this.onSocketClose?.();
          return;
        }

        // 非主动关闭的情况
        otziConsole.log(`WebSocket 连接关闭: ${event.code} ${event.reason}`);
        this.handleReconnect();
      };

      this.socket.onerror = (error: Event) => {
        otziConsole.error('WebSocket 连接错误:', error);
        this.onSocketError?.(error.toString());
      };

      this.socket.onmessage = (event: MessageEvent) => {
        otziConsole.log('收到 WebSocket 消息:', event.data);
        this.onSocketMessage?.(event.data);
      };

      this.isActive = true;
    } catch (e) {
      otziConsole.error('创建 WebSocket 失败:', e);
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (!this.isActive) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      otziConsole.log(
        `尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      otziConsole.error('达到最大重连次数，放弃连接');
    }
  }

  // 发送数据
  send(data: string): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      return true;
    }
    otziConsole.warn('WebSocket 未连接，无法发送数据');
    return false;
  }

  // 关闭连接
  disconnect(): void {
    this.isActive = false;
    if (this.socket) {
      this.socket.close(1000, '客户端主动断开');
      this.socket = null;
    }
  }

  // 主动停止

  // 获取连接状态
  get connectionState(): number {
    return this.socket ? this.socket.readyState : -1;
  }
}
