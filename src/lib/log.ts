export const otziConsole = {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  log: (...args: any[]) => {
    if (isLogOpen()) {
      console.log('[OtziASR]', ...args);
    }
  },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  warn: (...args: any[]) => {
    if (isLogOpen()) {
      console.warn('[OtziASR]', ...args);
    }
  },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  error: (...args: any[]) => {
    if (isLogOpen()) {
      console.error('[OtziASR]', ...args);
    }
  },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  info: (...args: any[]) => {
    if (isLogOpen()) {
      console.info('[OtziASR]', ...args);
    }
  },
};

const isLogOpen = () => window.otziASR.LOG;
