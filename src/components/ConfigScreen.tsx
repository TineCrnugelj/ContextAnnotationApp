import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, RotateCcw, Wifi, WifiOff } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useMqtt } from "@/hooks/useMqtt";
import { toast } from "@/hooks/use-toast";

interface ConfigScreenProps {
  onBack: () => void;
}

export const ConfigScreen = ({ onBack }: ConfigScreenProps) => {
  const { config, loadFromFile, resetToDefaults } = useConfig();
  const { connect, disconnect, isConnected } = useMqtt();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [testing, setTesting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
      toast({
        title: "Configuration Loaded",
        description: `Loaded ${file.name} successfully`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to parse configuration file",
        variant: "destructive",
      });
    }
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    resetToDefaults();
    toast({ title: "Configuration Reset", description: "Defaults restored" });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await connect();
      toast({
        title: "MQTT Connected",
        description: "Connection to broker succeeded",
      });
      // Keep connected briefly so user sees the badge, then disconnect
      setTimeout(() => disconnect(), 3000);
    } catch (err: any) {
      toast({
        title: "MQTT Connection Failed",
        description: err?.message ?? "Could not connect to broker",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const sections = Object.entries(config);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b p-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">Configuration</h1>
        <Badge
          variant={isConnected ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          {isConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          MQTT {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ini,.txt,.conf"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Load .ini File
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Defaults
        </Button>
        <Button
          variant="default"
          onClick={handleTestConnection}
          disabled={testing}
        >
          <Wifi className="mr-2 h-4 w-4" />
          {testing ? "Testing…" : "Test MQTT Connection"}
        </Button>
      </div>

      {/* Config Sections */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {sections.map(([section, entries]) => (
          <Card key={section} className="p-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              [{section}]
            </h2>
            <div className="space-y-2">
              {Object.entries(entries).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center text-sm gap-4"
                >
                  <span className="font-mono text-muted-foreground shrink-0">
                    {key}
                  </span>
                  <span className="font-mono text-right break-all">
                    {key.toLowerCase().includes("password")
                      ? "••••••••"
                      : value || "(empty)"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
