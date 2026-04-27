import { useRef, useState, useCallback } from "react";
import mqtt from "mqtt";
import { useConfig } from "@/hooks/useConfig";

export function useMqtt() {
  const { getMqtt } = useConfig();
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (clientRef.current?.connected) {
        resolve();
        return;
      }

      const cfg = getMqtt();
      const url = `${cfg.brokerUrl}:${cfg.port}`;

      const client = mqtt.connect(url, {
        username: cfg.username,
        password: cfg.password,
        rejectUnauthorized: false,
        connectTimeout: 5000,
        reconnectPeriod: 0, // no auto-reconnect; we manage lifecycle manually
      });

      const timeout = setTimeout(() => {
        client.end(true);
        reject(new Error("MQTT connection timed out"));
      }, 6000);

      client.on("connect", () => {
        clearTimeout(timeout);
        clientRef.current = client;
        setIsConnected(true);
        resolve();
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        client.end(true);
        setIsConnected(false);
        reject(err);
      });

      client.on("close", () => {
        setIsConnected(false);
      });
    });
  }, [getMqtt]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const publish = useCallback(
    (payload: object) => {
      const cfg = getMqtt();
      if (!clientRef.current?.connected) {
        console.warn("MQTT not connected, skipping publish");
        return;
      }
      clientRef.current.publish(cfg.topic, JSON.stringify(payload, null, 0));
    },
    [getMqtt],
  );

  return { connect, disconnect, publish, isConnected };
}
