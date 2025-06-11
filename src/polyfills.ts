// 基础 polyfills
import 'core-js/stable';
import 'whatwg-fetch';

// 解决 TypeScript 类型问题
declare global {
  interface Navigator {
    webkitGetUserMedia?: (
      constraints: MediaStreamConstraints,
      successCallback: (stream: MediaStream) => void,
      errorCallback: (error: Error) => void,
    ) => void;
    mozGetUserMedia?: typeof navigator.webkitGetUserMedia;
    msGetUserMedia?: typeof navigator.webkitGetUserMedia;
    getUserMedia?: typeof navigator.webkitGetUserMedia;
  }

  interface MediaDevices {
    getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  }
}

// 仅保留 getUserMedia 兼容处理
if (navigator.mediaDevices === undefined) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  (navigator as any).mediaDevices = {};
}

if (
  navigator.mediaDevices &&
  navigator.mediaDevices.getUserMedia === undefined
) {
  navigator.mediaDevices.getUserMedia = (
    constraints: MediaStreamConstraints,
  ) => {
    const getUserMedia =
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (!getUserMedia) {
      return Promise.reject(new Error('getUserMedia 不被支持'));
    }

    return new Promise((resolve, reject) => {
      getUserMedia.call(
        navigator,
        constraints,
        (stream: MediaStream) => resolve(stream),
        (err: Error) => reject(new Error(`麦克风访问失败: ${err.name}`)),
      );
    });
  };
}
