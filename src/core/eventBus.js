// Simple Pub/Sub
const listeners = {};
export function on(event, cb) {
  listeners[event] = listeners[event] || [];
  listeners[event].push(cb);
}
export function off(event, cb) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter((f) => f !== cb);
}
export function emit(event, payload) {
  if (!listeners[event]) return;
  listeners[event].forEach((f) => f(payload));
}
