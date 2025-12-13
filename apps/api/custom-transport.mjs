import pretty from 'pino-pretty';

export default (opts) => {
  return pretty({
    ...opts,
    colorize: true,
    translateTime: 'HH:MM:ss.l',
    ignore: 'pid,hostname',
    singleLine: true,
    errorLikeObjectKeys: ['err', 'error'],
    messageFormat: (log, messageKey) => {
      // Extract reqId from various possible locations
      const reqId = log.reqId || log.req?.id || log.requestId || 'startup';
      // Map pino log levels to labels
      const levelMap = {
        10: 'TRACE',
        20: 'DEBUG',
        30: 'INFO',
        40: 'WARN',
        50: 'ERROR',
        60: 'FATAL'
      };
      const level = levelMap[log.level] || 'INFO';
      const message = log[messageKey] || log.msg || '';
      return `${level} [${reqId}] ${message}`;
    },
    customColors: 'error:red,warn:yellow,info:blue,debug:gray',
  });
};

