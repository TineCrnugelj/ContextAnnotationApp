import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Clock,
  Calendar,
  Trash2,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Event {
  id: string;
  timestamp: string;
  offset_ms: number;
  event_type: {
    label: string;
  };
}

interface Recording {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  status: string;
  video_url: string | null;
  events?: Event[];
}

interface MonitorScreenProps {
  onBack: () => void;
}

export const MonitorScreen = ({ onBack }: MonitorScreenProps) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null
  );

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const { data: recordingsData, error: recordingsError } = await supabase
        .from("recordings")
        .select("*")
        .order("start_time", { ascending: false });

      if (recordingsError) throw recordingsError;

      // Fetch events for all recordings
      const recordingsWithEvents = await Promise.all(
        (recordingsData || []).map(async (recording) => {
          const { data: eventsData, error: eventsError } = await supabase
            .from("events")
            .select(
              `
              id,
              timestamp,
              offset_ms,
              event_type:event_types (
                label
              )
            `
            )
            .eq("recording_id", recording.id)
            .order("offset_ms", { ascending: true });

          if (eventsError) {
            console.error("Error loading events:", eventsError);
            return { ...recording, events: [] };
          }

          return { ...recording, events: eventsData || [] };
        })
      );

      setRecordings(recordingsWithEvents);
    } catch (error) {
      console.error("Error loading recordings:", error);
      toast({
        title: "Error",
        description: "Failed to load recordings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimestamp = (offsetMs: number) => {
    const totalSeconds = Math.floor(offsetMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const ms = offsetMs % 1000;
    return `${mins}:${secs.toString().padStart(2, "0")}.${Math.floor(
      ms / 100
    )}`;
  };

  const handleDownload = async (videoUrl: string, recordingId: string) => {
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recording-${recordingId}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Video is being saved to your device",
      });
    } catch (error) {
      console.error("Error downloading video:", error);
      toast({
        title: "Error",
        description: "Failed to download video",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (recordingId: string, videoUrl: string | null) => {
    try {
      // Delete video file from storage if it exists
      if (videoUrl) {
        const fileName = `${recordingId}.webm`;
        const { error: storageError } = await supabase.storage
          .from("recordings")
          .remove([fileName]);

        if (storageError) {
          console.error("Error deleting video file:", storageError);
        }
      }

      // Delete events (should cascade automatically if foreign key is set up)
      const { error: eventsError } = await supabase
        .from("events")
        .delete()
        .eq("recording_id", recordingId);

      if (eventsError) throw eventsError;

      // Delete recording
      const { error: recordingError } = await supabase
        .from("recordings")
        .delete()
        .eq("id", recordingId);

      if (recordingError) throw recordingError;

      // Update local state
      setRecordings(recordings.filter((r) => r.id !== recordingId));

      toast({
        title: "Recording deleted",
        description: "Recording and associated events have been removed",
      });
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive",
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
        <h1 className="text-lg font-semibold">Monitor Mode</h1>
        <div className="w-20" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading recordings...</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No recordings found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start recording to see your sessions here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((recording) => (
              <Card key={recording.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formatDate(recording.start_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Duration: {formatDuration(recording.duration_seconds)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      recording.status === "completed" ? "default" : "secondary"
                    }
                  >
                    {recording.status}
                  </Badge>
                </div>

                {recording.events && recording.events.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      Events
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {recording.events.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground">
                            {event.event_type?.label || "Unknown Event"}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatTimestamp(event.offset_ms)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {recording.video_url && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedRecording(recording)}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownload(recording.video_url!, recording.id)
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      handleDelete(recording.id, recording.video_url)
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedRecording && selectedRecording.video_url && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recording Playback</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecording(null)}
              >
                Close
              </Button>
            </div>
            <video
              src={selectedRecording.video_url}
              controls
              className="w-full aspect-video bg-muted"
            />
          </Card>
        </div>
      )}
    </div>
  );
};
