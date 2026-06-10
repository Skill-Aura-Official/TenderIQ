import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

const WS_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') + '/ws' || 'ws://localhost:5000/api/v1/ws';

/**
 * A hook that connects to the TenderIQ real-time WebSocket.
 * It will automatically call `onEvent` when a relevant broadcast is received.
 */
export function useRealtime(
  onEvent: (event: { type: string; payload: any; timestamp: number }) => void,
  enabled: boolean = true
) {
  const { getToken, isLoaded, userId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId || !enabled) return;

    let reconnectTimer: NodeJS.Timeout;
    
    const connect = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'connected') {
              console.log('Real-time connection established for org:', data.orgId);
            } else {
              // It's a broadcast event (e.g., tender_created, pipeline_updated, vault_updated)
              onEvent(data);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Try to reconnect after 3 seconds
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          ws.close(); // Triggers onclose to reconnect
        };
      } catch (err) {
        console.error('Failed to connect to WebSocket:', err);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isLoaded, userId, getToken, onEvent]);

  return { isConnected };
}
