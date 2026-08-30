import { EventEmitter } from "events";

declare global {
  // eslint-disable-next-line no-var
  var __realtimeHub: EventEmitter | undefined;
}

export function getRealtimeHub(): EventEmitter {
  if (!global.__realtimeHub) {
    global.__realtimeHub = new EventEmitter();
    global.__realtimeHub.setMaxListeners(200);
  }
  return global.__realtimeHub;
}

export type RealtimeEvent = {
  type: "BOOKING_CREATED" | "BOOKING_UPDATED" | "STATUS_CHANGED" | "QUEUE_ADVANCED" | "CALL_NEXT" | "PAYMENT_CREATED" | "PAYMENT_UPDATED";
  centreId?: string;
  farmerId?: string;
  bookingId?: string;
  paymentId?: string;
  paymentStatus?: string;
  status?: string;
  timestamp: string;
};

export function broadcastRealtimeEvent(event: Omit<RealtimeEvent, "timestamp">) {
  const fullEvent: RealtimeEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  const hub = getRealtimeHub();
  hub.emit("event", fullEvent);
}
