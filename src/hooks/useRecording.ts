import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [recordingWithVideo, setRecordingWithVideo] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(
    async (stream: MediaStream, withVideo: boolean = true) => {
      try {
        // Create recording entry in database
        const { data: recording, error } = await supabase
          .from("recordings")
          .insert({
            status: "recording",
            start_time: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        setRecordingId(recording.id);
        setRecordingStartTime(Date.now());
        setRecordingWithVideo(withVideo);
        streamRef.current = stream;

        if (withVideo) {
          // Set up media recorder
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: "video/webm;codecs=vp8",
          });

          videoChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              videoChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.start(); // Capture in 1-second chunks
          mediaRecorderRef.current = mediaRecorder;
        }

        setIsRecording(true);

        toast({
          title: "Recording started",
          description: withVideo
            ? "Video and event annotations are being recorded"
            : "Event annotations are being recorded",
        });
      } catch (error) {
        console.error("Error starting recording:", error);
        toast({
          title: "Error",
          description: "Failed to start recording",
          variant: "destructive",
        });
      }
    },
    []
  );

  const stopRecording = useCallback(async () => {
    if (!recordingId || !recordingStartTime) return;

    setIsSaving(true);

    try {
      const durationSeconds = Math.floor(
        (Date.now() - recordingStartTime) / 1000
      );

      if (recordingWithVideo && mediaRecorderRef.current) {
        // Handle video recording stop
        return new Promise<void>((resolve) => {
          const mediaRecorder = mediaRecorderRef.current!;

          mediaRecorder.onstop = async () => {
            try {
              const videoBlob = new Blob(videoChunksRef.current, {
                type: "video/webm",
              });
              const fileName = `${recordingId}.webm`;

              // 1. Create signed upload URL
              const { data: uploadData, error: signedUploadError } =
                await supabase.storage
                  .from("recordings")
                  .createSignedUploadUrl(fileName);

              if (signedUploadError) throw signedUploadError;

              // 2. Upload directly to Storage
              const uploadResponse = await fetch(uploadData.signedUrl, {
                method: "PUT",
                headers: {
                  "Content-Type": "video/webm",
                },
                body: videoBlob,
              });

              if (!uploadResponse.ok) {
                throw new Error("Failed to upload video");
              }

              // Get signed URL (valid for 1 year)
              const { data: signedUrlData, error: signedUrlError } =
                await supabase.storage
                  .from("recordings")
                  .createSignedUrl(fileName, 31536000); // 1 year in seconds

              if (signedUrlError) throw signedUrlError;

              // Update recording with end time and video URL
              const { error: updateError } = await supabase
                .from("recordings")
                .update({
                  end_time: new Date().toISOString(),
                  video_url: signedUrlData.signedUrl,
                  status: "completed",
                  duration_seconds: durationSeconds,
                })
                .eq("id", recordingId);

              if (updateError) throw updateError;

              toast({
                title: "Recording saved",
                description:
                  "Video and annotations have been saved successfully",
              });

              setIsRecording(false);
              setRecordingId(null);
              setRecordingStartTime(null);
              setRecordingWithVideo(false);
              setIsSaving(false);
              videoChunksRef.current = [];

              resolve();
            } catch (error) {
              console.error("Error stopping recording:", error);
              toast({
                title: "Error",
                description: "Failed to save recording",
                variant: "destructive",
              });
              setIsSaving(false);
              resolve();
            }
          };

          mediaRecorder.stop();
        });
      } else {
        // Handle events-only recording stop
        const { error: updateError } = await supabase
          .from("recordings")
          .update({
            end_time: new Date().toISOString(),
            status: "completed",
            duration_seconds: durationSeconds,
          })
          .eq("id", recordingId);

        if (updateError) throw updateError;

        toast({
          title: "Recording saved",
          description: "Event annotations have been saved successfully",
        });

        setIsRecording(false);
        setRecordingId(null);
        setRecordingStartTime(null);
        setRecordingWithVideo(false);
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast({
        title: "Error",
        description: "Failed to save recording",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  }, [recordingId, recordingStartTime, recordingWithVideo]);

  const logEvent = useCallback(
    async (eventCodeId: string) => {
      if (!recordingId || !recordingStartTime) return;

      const now = Date.now();
      const offsetMs = now - recordingStartTime;

      try {
        const { error } = await supabase.from("events").insert({
          recording_id: recordingId,
          event_code_id: eventCodeId,
          timestamp: new Date().toISOString(),
          offset_ms: offsetMs,
        });

        if (error) throw error;
      } catch (error) {
        console.error("Error logging event:", error);
      }
    },
    [recordingId, recordingStartTime]
  );

  const logSensorData = useCallback(
    async (sensorTypeId: string, data: any) => {
      if (!recordingId || !recordingStartTime) return;

      const now = Date.now();
      const offsetMs = now - recordingStartTime;

      try {
        const { error } = await supabase.from("sensor_data").insert({
          recording_id: recordingId,
          sensor_type_id: sensorTypeId,
          timestamp: new Date().toISOString(),
          offset_ms: offsetMs,
          data,
        });

        if (error) throw error;
      } catch (error) {
        console.error("Error logging sensor data:", error);
      }
    },
    [recordingId, recordingStartTime]
  );

  return {
    isRecording,
    isSaving,
    recordingId,
    startRecording,
    stopRecording,
    logEvent,
    logSensorData,
  };
};
