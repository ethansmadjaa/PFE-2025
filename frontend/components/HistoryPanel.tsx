"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { historyCache, HistoryEntry } from "@/lib/historyCache";

interface DisplayEntry {
  id: string;
  timestamp: number;
  imageUrl: string;
  imageThumbnail: string;
  samples: { filename: string; description: string; audioUrl: string }[];
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry: (entry: DisplayEntry) => void;
}

export function HistoryPanel({
  isOpen,
  onClose,
  onSelectEntry,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<
    { id: string; timestamp: number; imageThumbnail: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<DisplayEntry | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const allEntries = await historyCache.getAllEntries();
      setEntries(
        allEntries.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          imageThumbnail: e.imageThumbnail,
        }))
      );
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadEntries();
    }
  }, [isOpen, loadEntries]);

  const handleExpandEntry = async (id: string) => {
    try {
      const entry = await historyCache.getEntry(id);
      if (entry) {
        const displayEntry = await historyCache.entryToDisplayFormat(entry);
        setExpandedEntry(displayEntry);
      }
    } catch (err) {
      console.error("Failed to load entry:", err);
    }
  };

  const handleDeleteEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await historyCache.deleteEntryWithSync(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (expandedEntry?.id === id) {
        // Cleanup URLs before closing
        URL.revokeObjectURL(expandedEntry.imageUrl);
        expandedEntry.samples.forEach((s) => URL.revokeObjectURL(s.audioUrl));
        setExpandedEntry(null);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all history?")) {
      try {
        await historyCache.clearAllWithSync();
        setEntries([]);
        if (expandedEntry) {
          URL.revokeObjectURL(expandedEntry.imageUrl);
          expandedEntry.samples.forEach((s) => URL.revokeObjectURL(s.audioUrl));
          setExpandedEntry(null);
        }
      } catch (err) {
        console.error("Failed to clear history:", err);
      }
    }
  };

  const handleSelectEntry = () => {
    if (expandedEntry) {
      onSelectEntry(expandedEntry);
      onClose();
    }
  };

  const handleCloseExpanded = () => {
    if (expandedEntry) {
      URL.revokeObjectURL(expandedEntry.imageUrl);
      expandedEntry.samples.forEach((s) => URL.revokeObjectURL(s.audioUrl));
      setExpandedEntry(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
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
          </CardTitle>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleClearAll}>
                Clear All
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <svg
                className="h-12 w-12 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p>No history yet</p>
              <p className="text-sm mt-1">
                Generate some samples to see them here
              </p>
            </div>
          ) : expandedEntry ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleCloseExpanded}>
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </Button>
                <Button onClick={handleSelectEntry}>Load This Pack</Button>
              </div>

              <div className="flex items-start gap-4">
                <img
                  src={expandedEntry.imageUrl}
                  alt="Artwork"
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(expandedEntry.timestamp)}
                  </p>
                  <p className="font-medium">
                    {expandedEntry.samples.length} samples
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {expandedEntry.samples.map((sample, index) => (
                  <div
                    key={sample.filename}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {sample.filename}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {sample.description}
                    </p>
                    <audio
                      controls
                      className="w-full h-8"
                      src={sample.audioUrl}
                      preload="metadata"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleExpandEntry(entry.id)}
                >
                  <img
                    src={entry.imageThumbnail}
                    alt="Artwork thumbnail"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatDate(entry.timestamp)}
                  </div>
                  <button
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    onClick={(e) => handleDeleteEntry(entry.id, e)}
                    title="Delete"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
