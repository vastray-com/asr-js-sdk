type FN = () => void;

type ASROnStopped = () => void;
type ASROnStarted = () => void;
type ASROnReceived = (data: Sentence) => void;
type StartOptions = {
  onStarted?: ASROnStarted;
  onReceived?: ASROnReceived;
};

type StartASR = (record_id: string, opts?: StartOptions) => Promise<void>;
type StopASR = (cb?: ASROnStopped) => Promise<void>;

type Word = {
  begin_time: number;
  end_time: number;
  word: string;
};
type Words = Word[];
type Sentence = {
  begin_time: number;
  content: string;
  end_time: number;
  is_sent: boolean;
  role_id: string;
  words: Words;
};
type Sentences = Sentence[];
type WSMessage = {
  event: 'recognized';
  data: Sentence;
};
