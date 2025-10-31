import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async (stream: MediaStream) => {
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
      streamRef.current = stream;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      toast({
        title: "Recording started",
        description: "Video and sensor data are being recorded",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Error",
        description: "Failed to start recording",
        variant: "destructive",
      });
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recordingId || !recordingStartTime)
      return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        try {
          const videoBlob = new Blob(videoChunksRef.current, {
            type: "video/webm",
          });
          const fileName = `${recordingId}.webm`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from("recordings")
            .upload(fileName, videoBlob, {
              contentType: "video/webm",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Get signed URL (valid for 1 year)
          const { data: signedUrlData, error: signedUrlError } =
            await supabase.storage
              .from("recordings")
              .createSignedUrl(fileName, 31536000); // 1 year in seconds

          if (signedUrlError) throw signedUrlError;

          // Update recording with end time and video URL
          const durationSeconds = Math.floor(
            (Date.now() - recordingStartTime) / 1000
          );

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

          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }

          toast({
            title: "Recording saved",
            description: "Video and annotations have been saved successfully",
          });

          setIsRecording(false);
          setRecordingId(null);
          setRecordingStartTime(null);
          videoChunksRef.current = [];

          resolve();
        } catch (error) {
          console.error("Error stopping recording:", error);
          toast({
            title: "Error",
            description: "Failed to save recording",
            variant: "destructive",
          });
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [recordingId, recordingStartTime]);

  const logEvent = useCallback(
    async (eventTypeId: string) => {
      if (!recordingId || !recordingStartTime) return;

      const now = Date.now();
      const offsetMs = now - recordingStartTime;

      try {
        const { error } = await supabase.from("events").insert({
          recording_id: recordingId,
          event_type_id: eventTypeId,
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
    recordingId,
    startRecording,
    stopRecording,
    logEvent,
    logSensorData,
  };
};
