import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video, VideoOff, Camera, Activity } from "lucide-react";
import { useRecording } from "@/hooks/useRecording";
import { useSensors } from "@/hooks/useSensors";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EventType {
  id: string;
  code: string;
  label: string;
  display_order: number;
}

interface RecordingScreenProps {
  onBack: () => void;
}

export const RecordingScreen = ({ onBack }: RecordingScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [showVideoDialog, setShowVideoDialog] = useState(false);

  const {
    isRecording,
    startRecording,
    stopRecording,
    logEvent,
    logSensorData,
  } = useRecording();

  const handleSensorData = async (sensorType: string, data: any) => {
    // Get sensor type ID
    const { data: sensorTypeData } = await supabase
      .from("sensor_types")
      .select("id")
      .eq("name", sensorType)
      .single();

    if (sensorTypeData) {
      logSensorData(sensorTypeData.id, data);
    }
  };

  const sensorStatus = useSensors(isRecording, handleSensorData);

  useEffect(() => {
    // Load event types
    const loadEventTypes = async () => {
      const { data, error } = await supabase
        .from("event_types")
        .select("*")
        .eq("enabled", true)
        .order("display_order");

      if (error) {
        console.error("Error loading event types:", error);
        toast({
          title: "Error",
          description: "Failed to load event types",
          variant: "destructive",
        });
        return;
      }

      setEventTypes(data || []);
    };

    loadEventTypes();

    // Request camera access
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        setCameraReady(true);
      } catch (error) {
        console.error("Error accessing camera:", error);
        toast({
          title: "Camera Error",
          description:
            "Failed to access camera. Please grant camera permissions.",
          variant: "destructive",
        });
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleStartStop = async () => {
    if (isRecording) {
      await stopRecording();
      setEventCount(0);
    } else {
      setShowVideoDialog(true);
    }
  };

  const handleStartWithVideo = async () => {
    setShowVideoDialog(false);
    if (stream) {
      await startRecording(stream, true);
      setEventCount(0);
    }
  };

  const handleStartWithoutVideo = async () => {
    setShowVideoDialog(false);
    if (stream) {
      await startRecording(stream, false);
      setEventCount(0);
    }
  };

  const handleEventClick = (eventTypeId: string) => {
    if (!isRecording) return;
    logEvent(eventTypeId);
    setEventCount((prev) => prev + 1);

    // Visual feedback
    const eventType = eventTypes.find((e) => e.id === eventTypeId);
    toast({
      title: "Event Logged",
      description: eventType?.label || "Event",
      duration: 1000,
    });
  };

  const sensorsOk =
    sensorStatus.accelerometer ||
    sensorStatus.gyroscope ||
    sensorStatus.geolocation;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b p-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold">Recording Mode</h1>
        <div className="w-20" />
      </div>

      {/* Status Bar */}
      <div className="bg-card border-b p-3 flex items-center justify-around">
        <Badge
          variant={cameraReady ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          <Camera className="h-3 w-3" />
          Camera {cameraReady ? "OK" : "Not Ready"}
        </Badge>
        <Badge
          variant={sensorsOk ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          <Activity className="h-3 w-3" />
          Sensors {sensorsOk ? "OK" : "Limited"}
        </Badge>
        {isRecording && (
          <Badge variant="destructive" className="animate-pulse">
            <div className="h-2 w-2 rounded-full bg-recording-foreground mr-2" />
            Recording
          </Badge>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-auto">
        {/* Video Preview */}
        <Card className="overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-video bg-muted object-cover"
          />
        </Card>

        {/* Event Grid */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Event Annotations</h2>
            <Badge variant="outline">{eventCount} events logged</Badge>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {eventTypes.slice(0, 16).map((event) => (
              <Button
                key={event.id}
                variant="outline"
                className="h-20 p-2 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                onClick={() => handleEventClick(event.id)}
                disabled={!isRecording}
              >
                {event.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Control Button */}
      <div className="bg-card border-t p-4">
        <Button
          onClick={handleStartStop}
          disabled={!cameraReady}
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          className="w-full h-14 text-lg font-semibold"
        >
          {isRecording ? (
            <>
              <VideoOff className="mr-2 h-5 w-5" />
              Stop Recording
            </>
          ) : (
            <>
              <Video className="mr-2 h-5 w-5" />
              Start Recording
            </>
          )}
        </Button>
      </div>

      {/* Video Recording Dialog */}
      <Dialog open={showVideoDialog} onOpenChange={setShowVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Video?</DialogTitle>
            <DialogDescription>
              Do you want to record video along with event annotations?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleStartWithoutVideo}
              className="w-full sm:w-auto"
            >
              No, Events Only
            </Button>
            <Button onClick={handleStartWithVideo} className="w-full sm:w-auto">
              Yes, Record Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
