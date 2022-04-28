const log = []

export function logEvent(event, ...args) {
  log.push(
    `${event}, ${new Date(Date.now()).toGMTString()}, ${args}`
  );
  console.log(log)
}

export function getEventLog() {
  return log.join('\n');
}
