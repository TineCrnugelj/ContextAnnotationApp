import { useState } from "react";
import { ModeSelector } from "@/components/ModeSelector";
import { RecordingScreen } from "@/components/RecordingScreen";
import { MonitorScreen } from "@/components/MonitorScreen";
import { ConfigScreen } from "@/components/ConfigScreen";

type Mode = "selection" | "recording" | "monitor" | "config";

const Index = () => {
  const [mode, setMode] = useState<Mode>("selection");

  const handleSelectMode = (
    selectedMode: "recording" | "monitor" | "config",
  ) => {
    setMode(selectedMode);
  };

  const handleBack = () => {
    setMode("selection");
  };

  return (
    <>
      {mode === "selection" && <ModeSelector onSelectMode={handleSelectMode} />}
      {mode === "recording" && <RecordingScreen onBack={handleBack} />}
      {mode === "monitor" && <MonitorScreen onBack={handleBack} />}
      {mode === "config" && <ConfigScreen onBack={handleBack} />}
    </>
  );
};

export default Index;
