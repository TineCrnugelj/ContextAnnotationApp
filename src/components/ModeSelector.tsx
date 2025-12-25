import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Video, Monitor } from "lucide-react";

interface ModeSelectorProps {
  onSelectMode: (mode: "recording" | "monitor") => void;
}

export const ModeSelector = ({ onSelectMode }: ModeSelectorProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Context Annotation</h1>
          <p className="text-muted-foreground">Select your mode to continue</p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => onSelectMode("recording")}
            className="w-full h-24 text-lg"
            variant="default"
            size="lg"
          >
            <Video className="mr-3 h-6 w-6" />
            Recording Mode
          </Button>

          <Button
            onClick={() => onSelectMode("monitor")}
            className="w-full h-24 text-lg"
            variant="secondary"
            size="lg"
          >
            <Monitor className="mr-3 h-6 w-6" />
            Monitor Mode
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Recording mode: Record and annotate interactions
          <br />
          Monitor mode: View stored recordings
        </p>
      </Card>
    </div>
  );
};
