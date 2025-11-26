"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HistoryPanel } from "@/components/HistoryPanel";
import { historyCache } from "@/lib/historyCache";
import JSZip from "jszip";

interface AudioSample {
  filename: string;
  description: string;
  audioUrl: string;
}

export default function Home() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<AudioSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from server on mount, then get count
  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Load from server first (syncs with local IndexedDB)
        await historyCache.loadFromServer();
      } catch (err) {
        console.error("Failed to load history from server:", err);
      }
      // Get count from local cache
      const entries = await historyCache.getAllEntries();
      setHistoryCount(entries.length);
    };
    loadHistory();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // Store current image for saving to cache after completion
  const currentImageRef = useRef<string | null>(null);

  const pollJobStatus = useCallback(
    async (jobId: string): Promise<void> => {
      const pollInterval = 2000; // Poll every 2 seconds

      const poll = async (): Promise<void> => {
        try {
          const response = await fetch(`/api/sample/${jobId}`);
          const status = await response.json();

          if (!response.ok) {
            throw new Error(status.error || "Failed to get job status");
          }

          // Update progress based on backend status
          setProgress(status.progress);
          setLoadingMessage(status.current_step);

          if (status.status === "completed") {
            // Download the ZIP file
            setLoadingMessage("Downloading sample pack...");
            const downloadResponse = await fetch(
              `/api/sample/${jobId}/download`
            );

            if (!downloadResponse.ok) {
              throw new Error("Failed to download sample pack");
            }

            const zipBlob = await downloadResponse.blob();
            const zip = await JSZip.loadAsync(zipBlob);

            const metadataFile = zip.file("metadata.json");
            if (!metadataFile) {
              throw new Error("Invalid response: missing metadata");
            }

            const metadataText = await metadataFile.async("text");
            const metadata = JSON.parse(metadataText);

            const audioSamples: AudioSample[] = [];
            for (const sample of metadata.samples) {
              const audioFile = zip.file(sample.filename);
              if (audioFile) {
                const audioBlob = await audioFile.async("blob");
                const audioUrl = URL.createObjectURL(audioBlob);
                audioSamples.push({
                  filename: sample.filename,
                  description: sample.description,
                  audioUrl,
                });
              }
            }

            setProgress(100);
            setSamples(audioSamples);
            setIsLoading(false);
            setLoadingMessage("");

            // Save to history cache (with server sync)
            if (currentImageRef.current) {
              try {
                await historyCache.saveEntryWithSync(
                  currentImageRef.current,
                  audioSamples
                );
                setHistoryCount((prev) => prev + 1);
              } catch (cacheErr) {
                console.error("Failed to save to history:", cacheErr);
              }
            }
          } else if (status.status === "failed") {
            throw new Error(status.error || "Job failed");
          } else {
            // Continue polling
            setTimeout(poll, pollInterval);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
          setIsLoading(false);
          setLoadingMessage("");
          setProgress(0);
        }
      };

      await poll();
    },
    []
  );

  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file");
        return;
      }

      setError(null);
      setSamples([]);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Full = e.target?.result as string;
        setImagePreview(base64Full);
        currentImageRef.current = base64Full;

        const base64Data = base64Full.split(",")[1];

        setIsLoading(true);
        setLoadingMessage("Starting generation...");
        setProgress(0);

        try {
          // Create job
          const response = await fetch("/api/sample", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image_base64: base64Data }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to start generation");
          }

          // Start polling for status
          setLoadingMessage("Job started, waiting for progress...");
          await pollJobStatus(data.job_id);
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
          setIsLoading(false);
          setLoadingMessage("");
          setProgress(0);
        }
      };

      reader.readAsDataURL(file);
    },
    [pollJobStatus]
  );

  // Handle loading entry from history
  const handleSelectFromHistory = useCallback(
    (entry: {
      id: string;
      timestamp: number;
      imageUrl: string;
      imageThumbnail: string;
      samples: { filename: string; description: string; audioUrl: string }[];
    }) => {
      // Clean up current samples
      samples.forEach((sample) => URL.revokeObjectURL(sample.audioUrl));

      setImagePreview(entry.imageUrl);
      setSamples(entry.samples);
      setError(null);
    },
    [samples]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleReset = useCallback(() => {
    setImagePreview(null);
    setSamples([]);
    setError(null);
    samples.forEach((sample) => URL.revokeObjectURL(sample.audioUrl));
  }, [samples]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute right-0 top-0 flex items-center gap-2"
            onClick={() => setIsHistoryOpen(true)}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
            {historyCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {historyCount}
              </span>
            )}
          </Button>
          <h1 className="text-4xl font-bold tracking-tight">
            Art to Audio Sample Pack
          </h1>
          <p className="mt-2 text-muted-foreground">
            Transform your artwork into unique audio samples using AI
          </p>
        </header>

        {!imagePreview && !isLoading && (
          <Card
            className={`cursor-pointer transition-all ${
              isDragOver
                ? "border-primary bg-primary/5 border-2"
                : "border-dashed border-2 hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 rounded-full bg-muted p-4">
                <svg
                  className="h-8 w-8 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium">
                Drop your artwork here or click to upload
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                PNG, JPG, WEBP up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </CardContent>
          </Card>
        )}

        {imagePreview && !isLoading && samples.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center py-8">
              <img
                src={imagePreview}
                alt="Uploaded artwork"
                className="max-h-64 rounded-lg object-contain"
              />
              <p className="mt-4 text-muted-foreground">Processing...</p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Uploaded artwork"
                    className="mb-6 max-h-48 rounded-lg object-contain opacity-75"
                  />
                )}
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-lg font-medium">{loadingMessage}</p>
                </div>
                <Progress value={progress} className="w-full max-w-md" />
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  This may take a few minutes. We&apos;re generating 10 unique
                  audio samples based on your artwork.
                </p>

                <div className="mt-8 grid w-full gap-4 md:grid-cols-2">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="flex-1">
                        <Skeleton className="mb-2 h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={handleReset}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {samples.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Source artwork"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-semibold">
                    Your Sample Pack is Ready
                  </h2>
                  <p className="text-muted-foreground">
                    {samples.length} audio samples generated
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleReset}>
                Create New
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {samples.map((sample, index) => (
                <Card key={sample.filename} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </span>
                      {sample.filename}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {sample.description}
                    </p>
                    <audio
                      controls
                      className="w-full"
                      src={sample.audioUrl}
                      preload="metadata"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          onSelectEntry={handleSelectFromHistory}
        />
      </div>
    </div>
  );
}
