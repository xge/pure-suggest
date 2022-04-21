export function logEvent(event, ...args) {
  console.log(
    `User Action: ${event},
    ${new Date(Date.now()).toGMTString()},
    ${args}`
  );
}