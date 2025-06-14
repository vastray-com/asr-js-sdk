type RecorderOnStopped = () => void;
type RecorderOnStarted = () => void;
type RecorderOnChunked = (data: string) => void;
type RecorderOptions = {
  onStarted?: RecorderOnStarted;
  onChunked?: RecorderOnChunked;
  onStopped?: RecorderOnStopped;
};

type StartResult = {
  success: boolean;
  message?: string;
};
