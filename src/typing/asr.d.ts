type FN = () => void;

type ASROnStopped = () => void;
type ASROnStarted = () => void;
type ASROnRecognized = (data: Sentence) => void;
type ASROnTips = (data: string[]) => void;
type ASROnMedicalRecord = (data: Record<string, string>) => void;
type ASROnTerminated = (data: string) => void;
type StartOptions = {
  onStarted?: ASROnStarted;
  onRecognized?: ASROnRecognized;
  onTips?: ASROnTips;
  onMedicalRecord?: ASROnMedicalRecord;
  onTerminated?: ASROnTerminated;
};

type StartASR = (record_id: string, url: string, opts?: StartOptions) => Promise<void>;
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
type WSMessage =
  | WSDoneMessage
  | WSRecognizedMessage
  | WSTipsMessage
  | WSMedicalRecordMessage
  | WSTerminatedMessage;

type WSDoneMessage = {
  event: 'done';
};
type WSRecognizedMessage = {
  event: 'recognized';
  data: Sentence;
};
type WSTipsMessage = {
  event: 'tips';
  data: string[];
};
type WSMedicalRecordMessage = {
  event: 'medical_record';
  data: Record<string, string>;
};
type WSTerminatedMessage = {
  event: 'terminated';
  data: string;
};
