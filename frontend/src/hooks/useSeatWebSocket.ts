import { useEffect, useRef } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";

import type { SeatUpdateMessage } from "@/types/booking";

export function useSeatWebSocket(
  eventId: string | undefined,
  onUpdate: (msg: SeatUpdateMessage) => void,
) {
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  useEffect(() => {
    if (!eventId) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/events/${eventId}/seats`;
    const ws = new ReconnectingWebSocket(url, [], {
      maxRetries: Infinity,
      maxReconnectionDelay: 10_000,
      minReconnectionDelay: 500,
      connectionTimeout: 4000,
    });

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SeatUpdateMessage;
        if (data.type === "seat_update") handlerRef.current(data);
      } catch {
        /* ignore malformed */
      }
    };
    ws.addEventListener("message", onMessage);
    return () => {
      ws.removeEventListener("message", onMessage);
      ws.close();
    };
  }, [eventId]);
}
