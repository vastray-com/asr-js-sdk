// 解决 TypeScript 类型问题
interface Window {
  otziASR: {
    LOG: boolean;
    start: StartASR;
    stop: StopASR;
  };
}

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
