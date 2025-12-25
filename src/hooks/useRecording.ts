import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const SENSOR_BATCH_INTERVAL = 5000; // Batch sensor data every 5 seconds

// Get supported mime type with audio
const getSupportedMimeType = () => {
  // Prefer codecs with explicit audio support
  const types = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log("Using mime type:", type);
      return type;
    }
  }
  console.log("Fallback to video/webm");
  return "video/webm";
};

interface SensorDataEntry {
  recording_id: string;
  sensor_type_id: string;
  timestamp: string;
  offset_ms: number;
  data: any;
}

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  const [recordingWithVideo, setRecordingWithVideo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef<number>(0);
  const uploadedChunksRef = useRef<string[]>([]);
  const pendingBlobRef = useRef<Blob>(new Blob([], { type: "video/webm" }));
  const currentRecordingIdRef = useRef<string | null>(null);

  // Sensor data batching
  const sensorBatchRef = useRef<SensorDataEntry[]>([]);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Flush sensor data batch to database
  const flushSensorBatch = useCallback(async () => {
    if (sensorBatchRef.current.length === 0) return;

    const batch = [...sensorBatchRef.current];
    sensorBatchRef.current = [];

    try {
      const { error } = await supabase.from("sensor_data").insert(batch);

      if (error) {
        console.error("Error inserting sensor batch:", error);
        // Don't re-add failed items to avoid infinite growth
      } else {
        console.log(`Flushed ${batch.length} sensor readings`);
      }
    } catch (error) {
      console.error("Error flushing sensor batch:", error);
    }
  }, []);

  // Start batch interval when recording starts
  useEffect(() => {
    if (isRecording) {
      batchIntervalRef.current = setInterval(() => {
        flushSensorBatch();
      }, SENSOR_BATCH_INTERVAL);
    } else {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
        batchIntervalRef.current = null;
      }
      // Don't auto-flush here - stopRecording handles final flush explicitly
    }

    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
      }
    };
  }, [isRecording, flushSensorBatch]);

  const uploadChunk = async (
    recId: string,
    chunk: Blob,
    index: number
  ): Promise<string> => {
    const fileName = `${recId}/chunk_${index.toString().padStart(5, "0")}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("recordings")
      .upload(fileName, chunk, {
        contentType: "video/webm",
        upsert: true,
      });

    if (uploadError) throw uploadError;
    return fileName;
  };

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
        currentRecordingIdRef.current = recording.id;
        setRecordingStartTime(Date.now());
        setRecordingWithVideo(withVideo);
        streamRef.current = stream;
        chunkIndexRef.current = 0;
        uploadedChunksRef.current = [];
        videoChunksRef.current = [];
        pendingBlobRef.current = new Blob([], { type: "video/webm" });
        sensorBatchRef.current = [];

        if (withVideo) {
          // Log stream track info for debugging
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();
          console.log(
            "Audio tracks:",
            audioTracks.length,
            audioTracks.map((t) => ({
              label: t.label,
              enabled: t.enabled,
              muted: t.muted,
            }))
          );
          console.log(
            "Video tracks:",
            videoTracks.length,
            videoTracks.map((t) => ({ label: t.label, enabled: t.enabled }))
          );

          if (audioTracks.length === 0) {
            console.warn("No audio tracks in stream!");
          }

          const mimeType = getSupportedMimeType();

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000,
          });

          mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
              // Accumulate data into pending blob
              pendingBlobRef.current = new Blob(
                [pendingBlobRef.current, event.data],
                { type: "video/webm" }
              );

              // Upload when chunk size threshold is reached
              if (
                pendingBlobRef.current.size >= CHUNK_SIZE &&
                currentRecordingIdRef.current
              ) {
                const chunkToUpload = pendingBlobRef.current;
                const currentIndex = chunkIndexRef.current;
                chunkIndexRef.current++;
                pendingBlobRef.current = new Blob([], { type: "video/webm" });

                try {
                  const fileName = await uploadChunk(
                    currentRecordingIdRef.current,
                    chunkToUpload,
                    currentIndex
                  );
                  uploadedChunksRef.current.push(fileName);
                  console.log(
                    `Uploaded chunk ${currentIndex}, size: ${chunkToUpload.size}`
                  );
                } catch (err) {
                  console.error("Error uploading chunk:", err);
                  // Store failed chunk for retry at end
                  videoChunksRef.current.push(chunkToUpload);
                }
              }
            }
          };

          mediaRecorder.start(1000);
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

    // IMMEDIATELY stop accepting new sensor data by clearing refs
    const finalRecordingId = recordingId;
    const finalRecordingStartTime = recordingStartTime;
    const finalRecordingWithVideo = recordingWithVideo;

    // Stop recording state immediately so sensors stop
    setIsRecording(false);
    setRecordingId(null);
    setRecordingStartTime(null);

    setIsSaving(true);

    // Flush remaining sensor data that was collected before stop
    const pendingSensorData = [...sensorBatchRef.current];
    sensorBatchRef.current = []; // Clear immediately to prevent any more additions

    // Clear the batch interval
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }

    // Flush the pending sensor data
    if (pendingSensorData.length > 0) {
      try {
        const { error } = await supabase
          .from("sensor_data")
          .insert(pendingSensorData);
        if (error) {
          console.error("Error flushing final sensor batch:", error);
        } else {
          console.log(
            `Flushed final ${pendingSensorData.length} sensor readings`
          );
        }
      } catch (error) {
        console.error("Error flushing final sensor batch:", error);
      }
    }

    try {
      const durationSeconds = Math.floor(
        (Date.now() - finalRecordingStartTime) / 1000
      );

      if (finalRecordingWithVideo && mediaRecorderRef.current) {
        return new Promise<void>((resolve) => {
          const mediaRecorder = mediaRecorderRef.current!;

          mediaRecorder.onstop = async () => {
            try {
              const remainingBlob = pendingBlobRef.current;
              const hasUploadedChunks = uploadedChunksRef.current.length > 0;
              const hasRemainingData = remainingBlob.size > 0;

              console.log(
                `Stop: uploaded chunks: ${uploadedChunksRef.current.length}, remaining: ${remainingBlob.size}`
              );

              if (!hasUploadedChunks && hasRemainingData) {
                // Short video - upload as single file
                const fileName = `${finalRecordingId}.webm`;

                const { error: uploadError } = await supabase.storage
                  .from("recordings")
                  .upload(fileName, remainingBlob, {
                    contentType: "video/webm",
                    upsert: true,
                  });

                if (uploadError) throw uploadError;

                const { data: signedUrlData, error: signedUrlError } =
                  await supabase.storage
                    .from("recordings")
                    .createSignedUrl(fileName, 31536000);

                if (signedUrlError) throw signedUrlError;

                const { error: updateError } = await supabase
                  .from("recordings")
                  .update({
                    end_time: new Date().toISOString(),
                    video_url: signedUrlData.signedUrl,
                    status: "completed",
                    duration_seconds: durationSeconds,
                  })
                  .eq("id", finalRecordingId);

                if (updateError) throw updateError;
              } else if (hasUploadedChunks) {
                // Long video - upload remaining data as final chunk
                if (hasRemainingData) {
                  const finalChunkIndex = chunkIndexRef.current;
                  const fileName = await uploadChunk(
                    finalRecordingId,
                    remainingBlob,
                    finalChunkIndex
                  );
                  uploadedChunksRef.current.push(fileName);
                  console.log(
                    `Uploaded final chunk ${finalChunkIndex}, size: ${remainingBlob.size}`
                  );
                }

                // Store metadata about chunks
                const { error: updateError } = await supabase
                  .from("recordings")
                  .update({
                    end_time: new Date().toISOString(),
                    status: "completed",
                    duration_seconds: durationSeconds,
                    metadata: {
                      chunks: uploadedChunksRef.current,
                      totalChunks: uploadedChunksRef.current.length,
                    },
                  })
                  .eq("id", finalRecordingId);

                if (updateError) throw updateError;
              } else {
                // No video data
                const { error: updateError } = await supabase
                  .from("recordings")
                  .update({
                    end_time: new Date().toISOString(),
                    status: "completed",
                    duration_seconds: durationSeconds,
                  })
                  .eq("id", finalRecordingId);

                if (updateError) throw updateError;
              }

              toast({
                title: "Recording saved",
                description:
                  "Video and annotations have been saved successfully",
              });

              // State already cleared at start of stopRecording
              setIsSaving(false);
              currentRecordingIdRef.current = null;
              setRecordingWithVideo(false);
              videoChunksRef.current = [];
              uploadedChunksRef.current = [];
              chunkIndexRef.current = 0;
              pendingBlobRef.current = new Blob([], { type: "video/webm" });

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
        const { error: updateError } = await supabase
          .from("recordings")
          .update({
            end_time: new Date().toISOString(),
            status: "completed",
            duration_seconds: durationSeconds,
          })
          .eq("id", finalRecordingId);

        if (updateError) throw updateError;

        toast({
          title: "Recording saved",
          description: "Event annotations have been saved successfully",
        });

        // State already cleared at start of stopRecording
        setIsSaving(false);
        currentRecordingIdRef.current = null;
        setRecordingWithVideo(false);
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
    (sensorTypeId: string, data: any) => {
      if (!recordingId || !recordingStartTime) return;

      const now = Date.now();
      const offsetMs = now - recordingStartTime;

      // Add to batch instead of immediate insert
      sensorBatchRef.current.push({
        recording_id: recordingId,
        sensor_type_id: sensorTypeId,
        timestamp: new Date().toISOString(),
        offset_ms: offsetMs,
        data,
      });
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
