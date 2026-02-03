"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { historyCache } from "@/lib/historyCache";
import { RemixDialog } from "@/components/RemixDialog";
import { RefreshCw } from "lucide-react";
import Image from "next/image";

interface DisplayEntry {
  id: string;
  timestamp: number;
  imageUrl: string;
  imageThumbnail: string;
  samples: {
    filename: string;
    description: string;
    audioUrl: string;
    versionCount: number;
  }[];
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
  const [remixTarget, setRemixTarget] = useState<{
    filename: string;
    description: string;
    audioUrl: string;
  } | null>(null);

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
      // Clear expandedEntry WITHOUT revoking URLs — they're now owned by the main page
      setExpandedEntry(null);
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

  const handleRemixComplete = useCallback(
    (filename: string, newAudioUrl: string, newDescription: string) => {
      if (!expandedEntry) return;

      setExpandedEntry((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          samples: prev.samples.map((s) => {
            if (s.filename === filename) {
              // Revoke old URL
              URL.revokeObjectURL(s.audioUrl);
              return {
                ...s,
                audioUrl: newAudioUrl,
                description: newDescription,
                versionCount: s.versionCount + 1,
              };
            }
            return s;
          }),
        };
      });
    },
    [expandedEntry]
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <Card className="w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-950/90 border-slate-800 shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/60 p-6 bg-slate-950/50">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <svg
                className="h-5 w-5 text-purple-400"
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
            </div>
            <span>Historique de Génération</span>
            <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
              {entries.length} éléments
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
              >
                Tout effacer
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-slate-800 rounded-full w-8 h-8"
            >
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

        <CardContent className="flex-1 overflow-auto p-6 relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <p className="text-slate-500 animate-pulse">Chargement de l'historique...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800">
                <svg
                  className="h-10 w-10 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">Historique vide</h3>
              <p className="max-w-xs text-center text-sm">
                Générez votre premier pack de samples pour commencer votre collection.
              </p>
            </div>
          ) : expandedEntry ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between bg-slate-950/95 backdrop-blur-md py-4 border-b border-slate-800 -mx-6 px-6 -mt-6 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseExpanded}
                  className="text-slate-400 hover:text-white pl-0 hover:bg-transparent group"
                >
                  <svg
                    className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1"
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
                  Retour à la bibliothèque
                </Button>
                <div className="flex gap-3">
                  <Button onClick={handleSelectEntry} className="bg-purple-600 hover:bg-purple-500">
                    Charger ce Pack
                  </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                {/* Visual Info */}
                <div className="md:w-1/3 shrink-0">
                  <div className="sticky top-24 space-y-4">
                    <div className="relative group rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl">
                      <div className="absolute inset-0 bg-linear-to-r from-purple-500/20 to-blue-500/20 mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Image
                        src={expandedEntry.imageUrl}
                        width={400}
                        height={400}
                        alt="Artwork"
                        className="w-full aspect-square object-cover"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 mb-2 text-xs uppercase tracking-wider font-semibold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        Créé le
                      </div>
                      <p className="text-white font-medium mb-4">
                        {new Date(expandedEntry.timestamp).toLocaleString('fr-FR', {
                          dateStyle: "full",
                          timeStyle: "short",
                        })}
                      </p>

                      <div className="flex items-center gap-2 text-slate-400 mb-2 text-xs uppercase tracking-wider font-semibold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                        Contenu
                      </div>
                      <p className="text-white font-medium">
                        {expandedEntry.samples.length} samples
                      </p>
                    </div>
                  </div>
                </div>

                {/* Samples List */}
                <div className="md:w-2/3 space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                    Collection de Samples
                  </h3>
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                    {expandedEntry.samples.map((sample, index) => (
                      <div
                        key={sample.filename}
                        className="group bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                              {index + 1}
                            </span>
                            <div>
                              <h4 className="font-medium text-slate-200 text-sm">{sample.filename}</h4>
                              <div className="flex gap-2 items-center mt-1">
                                {sample.versionCount > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/20">
                                    v{sample.versionCount + 1}
                                  </span>
                                )}
                                {sample.versionCount > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
                                    <RefreshCw className="w-2.5 h-2.5" />
                                    Remixé
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 pl-9 h-8">
                          {sample.description}
                        </p>

                        <div className="flex items-center gap-2 pl-9 mt-auto">
                          <audio
                            controls
                            className="w-full h-8 opacity-80 hover:opacity-100 transition-opacity"
                            src={sample.audioUrl}
                            preload="metadata"
                          >
                            Votre navigateur ne supporte pas l'audio.
                          </audio>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-8 w-8 p-0 rounded-full hover:bg-purple-500/20 hover:text-purple-400"
                            onClick={() => setRemixTarget(sample)}
                            title="Remixer ce sample"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pb-20">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300"
                  onClick={() => handleExpandEntry(entry.id)}
                >
                  <div className="aspect-square relative overflow-hidden">
                    <Image
                      width={300}
                      height={300}
                      src={entry.imageThumbnail}
                      alt="Artwork thumbnail"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-purple-900/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                      <span className="bg-white text-purple-900 px-4 py-2 rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        Voir le Pack
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 border-t border-slate-800 relative">
                    <p className="text-xs text-slate-400 font-medium truncate capitalize">
                      {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>

                    <button
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      onClick={(e) => handleDeleteEntry(entry.id, e)}
                      title="Supprimer"
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RemixDialog
        isOpen={!!remixTarget}
        onClose={() => setRemixTarget(null)}
        sample={remixTarget}
        entryId={expandedEntry?.id ?? null}
        onRemixComplete={handleRemixComplete}
      />
    </div>
  );
}
