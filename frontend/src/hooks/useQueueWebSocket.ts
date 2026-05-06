import { useEffect, useRef } from "react";
import ReconnectingWebSocket from "reconnecting-websocket";

import type { QueueGrantMessage } from "@/types/queue";

export function useQueueWebSocket(
  eventId: string | undefined,
  token: string | null,
  onGrant: (msg: QueueGrantMessage) => void,
) {
  const handlerRef = useRef(onGrant);
  handlerRef.current = onGrant;

  useEffect(() => {
    if (!eventId) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${proto}//${window.location.host}/ws/queue/${eventId}${tokenParam}`;
    const ws = new ReconnectingWebSocket(url, [], {
      maxRetries: Infinity,
      maxReconnectionDelay: 10_000,
      minReconnectionDelay: 500,
      connectionTimeout: 4000,
    });

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as QueueGrantMessage;
        if (data.type === "queue_grant") handlerRef.current(data);
      } catch {
        /* ignore malformed */
      }
    };
    ws.addEventListener("message", onMessage);
    return () => {
      ws.removeEventListener("message", onMessage);
      ws.close();
    };
  }, [eventId, token]);
}
