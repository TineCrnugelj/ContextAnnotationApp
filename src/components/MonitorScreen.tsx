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
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { Dialog, DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { DialogContent, DialogFooter, DialogHeader } from "./ui/dialog";

interface Event {
  id: string;
  timestamp: string;
  offset_ms: number;
  event_code: {
    e_description_butt: string;
  };
}

interface RecordingMetadata {
  chunks?: string[];
  totalChunks?: number;
}

interface Recording {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  status: string;
  video_url: string | null;
  metadata?: RecordingMetadata;
  events?: Event[];
  blobUrl?: string;
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
  const [loadingVideo, setLoadingVideo] = useState<string | null>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<{
    id: string;
    videoUrl: string | null;
  } | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const hasChunkedVideo = (recording: Recording) => {
    return recording.metadata?.chunks && recording.metadata.chunks.length > 0;
  };

  const hasVideo = (recording: Recording) => {
    return recording.video_url || hasChunkedVideo(recording);
  };

  const fetchChunkedVideo = async (
    recording: Recording
  ): Promise<string | null> => {
    if (!recording.metadata?.chunks) return null;

    try {
      const chunks = recording.metadata.chunks;
      const blobParts: Blob[] = [];

      for (const chunkPath of chunks) {
        const { data, error } = await supabase.storage
          .from("recordings")
          .download(chunkPath);

        if (error) throw error;
        blobParts.push(data);
      }

      const combinedBlob = new Blob(blobParts, { type: "video/webm" });
      return URL.createObjectURL(combinedBlob);
    } catch (error) {
      console.error("Error fetching chunked video:", error);
      return null;
    }
  };

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
              event_code:event_codes (
                e_description_butt
              )
            `
            )
            .eq("recording_id", recording.id)
            .order("offset_ms", { ascending: true });

          if (eventsError) {
            console.error("Error loading events:", eventsError);
            return {
              ...recording,
              metadata: recording.metadata as RecordingMetadata | undefined,
              events: [],
            };
          }

          return {
            ...recording,
            metadata: recording.metadata as RecordingMetadata | undefined,
            events: eventsData || [],
          };
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

  const handleViewVideo = async (recording: Recording) => {
    if (recording.video_url) {
      setSelectedRecording(recording);
      return;
    }

    if (hasChunkedVideo(recording)) {
      setLoadingVideo(recording.id);
      const blobUrl = await fetchChunkedVideo(recording);
      setLoadingVideo(null);

      if (blobUrl) {
        setSelectedRecording({ ...recording, blobUrl });
      } else {
        toast({
          title: "Error",
          description: "Failed to load video",
          variant: "destructive",
        });
      }
    }
  };

  const handleDownload = async (recording: Recording) => {
    try {
      let blob: Blob;

      if (recording.video_url) {
        const response = await fetch(recording.video_url);
        blob = await response.blob();
      } else if (hasChunkedVideo(recording)) {
        setLoadingVideo(recording.id);
        const chunks = recording.metadata!.chunks!;
        const blobParts: Blob[] = [];

        for (const chunkPath of chunks) {
          const { data, error } = await supabase.storage
            .from("recordings")
            .download(chunkPath);

          if (error) throw error;
          blobParts.push(data);
        }

        blob = new Blob(blobParts, { type: "video/webm" });
        setLoadingVideo(null);
      } else {
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recording-${recording.id}.webm`;
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
      setLoadingVideo(null);
      toast({
        title: "Error",
        description: "Failed to download video",
        variant: "destructive",
      });
    }
  };

  const handleDownloadEvents = async (recordingId: string) => {
    try {
      const { data: eventsData, error } = await supabase
        .from("events")
        .select(
          `
          id,
          recording_id,
          event_code_id,
          timestamp,
          offset_ms,
          metadata,
          created_at,
          event_code:event_codes (
            e_description_butt
          )
        `
        )
        .eq("recording_id", recordingId)
        .order("offset_ms", { ascending: true });

      if (error) throw error;

      if (!eventsData || eventsData.length === 0) {
        toast({
          title: "No events",
          description: "This recording has no events to export",
        });
        return;
      }

      // Transform data for Excel export
      const exportData = eventsData.map((event) => ({
        id: event.id,
        recording_id: event.recording_id,
        event_code_id: event.event_code_id,
        event_code_label: event.event_code?.e_description_butt || "",
        timestamp: event.timestamp,
        offset_ms: event.offset_ms,
        metadata: JSON.stringify(event.metadata),
        created_at: event.created_at,
      }));

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Events");

      // Download file
      XLSX.writeFile(workbook, `events-${recordingId}.xlsx`);

      toast({
        title: "Download started",
        description: "Events are being saved to your device",
      });
    } catch (error) {
      console.error("Error downloading events:", error);
      toast({
        title: "Error",
        description: "Failed to download events",
        variant: "destructive",
      });
    }
  };

  const showDeleteConfirmationDialog = (
    recordingId: string,
    videoUrl: string | null
  ) => {
    setRecordingToDelete({ id: recordingId, videoUrl });
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!recordingToDelete) return;

    try {
      if (recordingToDelete.videoUrl) {
        const fileName = `${recordingToDelete.id}.webm`;
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
        .eq("recording_id", recordingToDelete.id);

      if (eventsError) throw eventsError;

      // Delete recording
      const { error: recordingError } = await supabase
        .from("recordings")
        .delete()
        .eq("id", recordingToDelete.id);

      if (recordingError) throw recordingError;

      // Update local state
      setRecordings(recordings.filter((r) => r.id !== recordingToDelete.id));

      toast({
        title: "Recording deleted",
        description: "Recording and associated events have been removed",
      });

      setShowDeleteDialog(false);
      setRecordingToDelete(null);
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
                            {event.event_code?.e_description_butt ||
                              "Unknown Event"}
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
                  {hasVideo(recording) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewVideo(recording)}
                        disabled={loadingVideo === recording.id}
                      >
                        {loadingVideo === recording.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(recording)}
                        disabled={loadingVideo === recording.id}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {recording.events && recording.events.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadEvents(recording.id)}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      showDeleteConfirmationDialog(
                        recording.id,
                        recording.video_url
                      )
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
      {selectedRecording &&
        (selectedRecording.video_url || selectedRecording.blobUrl) && (
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
                src={
                  selectedRecording.blobUrl || selectedRecording.video_url || ""
                }
                controls
                className="w-full aspect-video bg-muted"
              />
            </Card>
          </div>
        )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recording?</DialogTitle>
            <DialogDescription>
              Do you want to delete video along with event annotations?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setRecordingToDelete(null);
              }}
              className="w-full sm:w-auto"
            >
              No
            </Button>
            <Button onClick={handleDelete} className="w-full sm:w-auto">
              Yes, Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
