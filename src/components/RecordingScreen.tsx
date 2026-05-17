import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Video,
  VideoOff,
  Camera,
  Activity,
  Navigation,
  Compass,
  Sun,
  Gauge,
  Loader2,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRecording } from "@/hooks/useRecording";
import { useSensors } from "@/hooks/useSensors";
import { useMqtt } from "@/hooks/useMqtt";
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

interface MqttPayload {
  eID: string;
  eInd: number;
  eDescriptionButt: string;
  eDescriptionENGL: string;
}

interface EventCode {
  id: string;
  e_ind: number;
  e_description_engl: string;
  e_description_slo: string;
  e_id: string;
  e_description_butt: string;
  notes: string | null;
  enabled: boolean;
  e_active: "Y" | "N";
  mqtt_payload: MqttPayload | null;
}

interface RecordingScreenProps {
  onBack: () => void;
}

export const RecordingScreen = ({ onBack }: RecordingScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [eventCodes, setEventCodes] = useState<EventCode[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [showVideoDialog, setShowVideoDialog] = useState(false);

  const {
    isRecording,
    isSaving,
    startRecording,
    stopRecording,
    logEvent,
    logSensorData,
  } = useRecording();

  const {
    connect: mqttConnect,
    disconnect: mqttDisconnect,
    publish: mqttPublish,
    isConnected: mqttConnected,
  } = useMqtt();

  // Cache sensor type ids (avoid a DB lookup on every sensor reading)
  const sensorTypeIdByNameRef = useRef<Record<string, string>>({});
  const sensorTypesLoadingRef = useRef<Promise<void> | null>(null);

  const ensureSensorTypesLoaded = useCallback(async () => {
    if (Object.keys(sensorTypeIdByNameRef.current).length > 0) return;
    if (sensorTypesLoadingRef.current) return sensorTypesLoadingRef.current;

    sensorTypesLoadingRef.current = (async () => {
      const { data, error } = await supabase
        .from("sensor_types")
        .select("id,name");

      if (error) {
        console.error("Error loading sensor types:", error);
        return;
      }

      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        map[row.name] = row.id;
      }
      sensorTypeIdByNameRef.current = map;
    })().finally(() => {
      sensorTypesLoadingRef.current = null;
    });

    return sensorTypesLoadingRef.current;
  }, []);

  const handleSensorData = useCallback(
    async (sensorType: string, data: any) => {
      // Extra guard: as soon as Stop is pressed, ignore anything still coming in.
      if (!isRecording) return;

      await ensureSensorTypesLoaded();
      const sensorTypeId = sensorTypeIdByNameRef.current[sensorType];
      if (!sensorTypeId) return;

      logSensorData(sensorTypeId, data);
    },
    [ensureSensorTypesLoaded, isRecording, logSensorData],
  );

  const sensorStatus = useSensors(isRecording, handleSensorData);

  useEffect(() => {
    // Load event codes
    const loadEventCodes = async () => {
      const { data, error } = await supabase
        .from("event_codes")
        .select("*")
        .eq("enabled", true)
        .order("e_ind");

      if (error) {
        console.error("Error loading event codes:", error);
        toast({
          title: "Error",
          description: "Failed to load event codes",
          variant: "destructive",
        });
        return;
      }

      setEventCodes((data as unknown as EventCode[]) || []);
    };

    loadEventCodes();

    // Request camera and audio access
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        const audioTracks = mediaStream.getAudioTracks();
        const videoTracks = mediaStream.getVideoTracks();

        console.log("Audio tracks available:", audioTracks.length);
        console.log("Video tracks available:", videoTracks.length);

        setCameraReady(videoTracks.length > 0);
        setAudioReady(audioTracks.length > 0);

        if (audioTracks.length === 0) {
          toast({
            title: "Audio Warning",
            description:
              "No microphone detected. Video will be recorded without audio.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        toast({
          title: "Camera Error",
          description:
            "Failed to access camera/microphone. Please grant permissions.",
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
      // Publish run_stop before stopping
      mqttPublish({
        action_id: "confID2",
        type: "control",
        params: { command: "run_stop" },
        meta: { priority: "high", source: "context-capture-companion" },
      });
      await stopRecording();
      mqttDisconnect();
      setEventCount(0);
    } else {
      setShowVideoDialog(true);
    }
  };

  const startWithMqtt = async (withVideo: boolean) => {
    setShowVideoDialog(false);
    if (!stream) return;

    // Connect MQTT first (non-blocking: warn but allow recording if it fails)
    try {
      await mqttConnect();
    } catch (err: any) {
      toast({
        title: "MQTT Warning",
        description: `Could not connect to MQTT broker: ${err?.message ?? "unknown error"}. Recording will proceed locally.`,
        variant: "destructive",
      });
    }

    await startRecording(stream, withVideo);
    setEventCount(0);

    // Publish run_stop after successful recording start
    mqttPublish({
      action_id: "confID2",
      type: "control",
      params: { command: "run_stop" },
      meta: { priority: "high", source: "context-capture-companion" },
    });
  };

  const handleStartWithVideo = () => startWithMqtt(true);
  const handleStartWithoutVideo = () => startWithMqtt(false);

  const handleEventClick = (eventCodeId: string) => {
    if (!isRecording) return;
    logEvent(eventCodeId);
    setEventCount((prev) => prev + 1);

    // Find the event code to build the MQTT payload
    const event = eventCodes.find((e) => e.id === eventCodeId);
    if (event?.mqtt_payload) {
      mqttPublish({
        action_id: event.mqtt_payload.eID,
        type: "event",
        params: {
          code: event.mqtt_payload.eDescriptionButt,
          description: event.mqtt_payload.eDescriptionENGL,
        },
        meta: {
          priority: "normal",
          source: "context-capture-companion",
          timestamp: Date.now(),
        },
      });
    }
  };

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
      <div className="bg-card border-b p-3 flex flex-wrap items-center gap-2">
        <Badge
          variant={cameraReady ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          <Camera className="h-3 w-3" />
          Camera {cameraReady ? "OK" : "Not Ready"}
        </Badge>
        <Badge
          variant={audioReady ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {audioReady ? (
            <Mic className="h-3 w-3" />
          ) : (
            <MicOff className="h-3 w-3" />
          )}
          Audio {audioReady ? "OK" : "No Mic"}
        </Badge>
        {sensorStatus.sensorStatus.accelerometer && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Accelerometer
          </Badge>
        )}
        {sensorStatus.sensorStatus.gyroscope && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            Gyroscope
          </Badge>
        )}
        {isRecording && (
          <Badge variant="destructive" className="animate-pulse">
            <div className="h-2 w-2 rounded-full bg-recording-foreground mr-2" />
            Recording
          </Badge>
        )}
        <Badge
          variant={mqttConnected ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          {mqttConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          MQTT {mqttConnected ? "OK" : "Off"}
        </Badge>
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
            {eventCodes.slice(0, 16).map(
              (event) =>
                event.e_active === "Y" && (
                  <Button
                    key={event.id}
                    variant="outline"
                    className="h-20 p-2 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                    onClick={() => handleEventClick(event.id)}
                    disabled={!isRecording}
                  >
                    {event.e_description_butt}
                  </Button>
                ),
            )}
          </div>
        </Card>
      </div>

      {/* Control Button */}
      <div className="bg-card border-t p-4">
        <Button
          onClick={handleStartStop}
          disabled={!cameraReady || isSaving}
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          className="w-full h-14 text-lg font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : isRecording ? (
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
