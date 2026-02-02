"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw } from "lucide-react";
import { historyCache } from "@/lib/historyCache";

interface RemixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sample: {
    filename: string;
    description: string;
    audioUrl: string;
  } | null;
  entryId: string | null;
  onRemixComplete: (
    filename: string,
    newAudioUrl: string,
    newDescription: string
  ) => void;
}

export function RemixDialog({
  isOpen,
  onClose,
  sample,
  entryId,
  onRemixComplete,
}: RemixDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [isRemixing, setIsRemixing] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!sample || !feedback.trim()) return;

    setIsRemixing(true);
    setError(null);
    setCurrentStep("Starting remix...");
    setProgress(0);

    try {
      // 1. Create remix job
      const response = await fetch("/api/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_description: sample.description,
          user_feedback: feedback.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start remix");
      }

      const jobId = data.job_id;

      // 2. Poll for status
      let newDescription: string | null = null;

      const pollRemix = (): Promise<void> =>
        new Promise((resolve, reject) => {
          const poll = async () => {
            try {
              const statusRes = await fetch(`/api/remix/${jobId}`);
              const status = await statusRes.json();

              if (!statusRes.ok) {
                reject(new Error(status.error || "Failed to get remix status"));
                return;
              }

              setProgress(status.progress);
              setCurrentStep(status.current_step);

              if (status.status === "completed") {
                newDescription = status.new_description;
                resolve();
              } else if (status.status === "failed") {
                reject(new Error(status.error || "Remix failed"));
              } else {
                setTimeout(poll, 2000);
              }
            } catch (err) {
              reject(err);
            }
          };
          poll();
        });

      await pollRemix();

      // 3. Download remixed audio
      setCurrentStep("Downloading new audio...");
      const downloadRes = await fetch(`/api/remix/${jobId}/download`);
      if (!downloadRes.ok) {
        throw new Error("Failed to download remix audio");
      }

      const audioBlob = await downloadRes.blob();
      const newAudioUrl = URL.createObjectURL(audioBlob);
      const finalDescription = newDescription || sample.description;

      // 4. Persist version in IndexedDB
      if (entryId) {
        try {
          await historyCache.remixSample(
            entryId,
            sample.filename,
            audioBlob,
            finalDescription
          );
        } catch (cacheErr) {
          console.error("Failed to save remix to history:", cacheErr);
        }
      }

      // 5. Notify parent
      onRemixComplete(sample.filename, newAudioUrl, finalDescription);

      // Reset and close
      setFeedback("");
      setIsRemixing(false);
      setCurrentStep("");
      setProgress(0);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsRemixing(false);
      setCurrentStep("");
      setProgress(0);
    }
  }, [sample, feedback, entryId, onRemixComplete, onClose]);

  const handleClose = () => {
    if (isRemixing) return; // Don't close while remixing
    setFeedback("");
    setError(null);
    onClose();
  };

  if (!sample) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-purple-400" />
            Remix Sample
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {sample.filename}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current sample info */}
          <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 space-y-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Description actuelle
            </p>
            <p className="text-sm text-slate-300">{sample.description}</p>
            <audio
              controls
              className="w-full h-8"
              src={sample.audioUrl}
              preload="metadata"
            />
          </div>

          {/* Feedback input */}
          {!isRemixing && (
            <div className="space-y-2">
              <label className="text-sm text-slate-400">
                Qu'est-ce que vous aimeriez changer ?
              </label>
              <Textarea
                placeholder="Ex: Plus de reverb, moins de basse, tempo plus rapide, son plus granulaire..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 min-h-[100px] resize-none"
              />
            </div>
          )}

          {/* Loading state */}
          {isRemixing && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              <p className="text-sm text-slate-300">{currentStep}</p>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-950/30 rounded-lg p-3">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isRemixing}
            className="text-slate-400 hover:text-slate-200"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isRemixing || !feedback.trim()}
            className="bg-purple-600 hover:bg-purple-500"
          >
            {isRemixing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Remixing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Remix
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
