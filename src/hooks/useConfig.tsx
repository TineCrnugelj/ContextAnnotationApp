import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { parseIni, type IniConfig } from "@/utils/iniParser";
import { DEFAULT_CONFIG_INI } from "@/config/defaults";

const STORAGE_KEY = "timo-config";

interface ConfigContextValue {
  config: IniConfig;
  loadFromText: (text: string) => void;
  loadFromFile: (file: File) => Promise<void>;
  resetToDefaults: () => void;
  getMqtt: () => {
    brokerUrl: string;
    port: number;
    topic: string;
    useTls: boolean;
    username: string;
    password: string;
  };
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

function loadStoredConfig(): IniConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // fall through to default
  }
  return parseIni(DEFAULT_CONFIG_INI);
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<IniConfig>(loadStoredConfig);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const loadFromText = useCallback((text: string) => {
    setConfig(parseIni(text));
  }, []);

  const loadFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      loadFromText(text);
    },
    [loadFromText],
  );

  const resetToDefaults = useCallback(() => {
    setConfig(parseIni(DEFAULT_CONFIG_INI));
  }, []);

  const getMqtt = useCallback(() => {
    const mqtt = config.mqtt ?? {};
    return {
      brokerUrl: mqtt.broker_url ?? "wss://hassio.lucami.org",
      port: parseInt(mqtt.port ?? "8884", 10),
      topic: mqtt.topic ?? "timo/actions",
      useTls: mqtt.use_tls !== "false",
      username: mqtt.username ?? "",
      password: mqtt.password ?? "",
    };
  }, [config]);

  return (
    <ConfigContext.Provider
      value={{ config, loadFromText, loadFromFile, resetToDefaults, getMqtt }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider");
  return ctx;
}
