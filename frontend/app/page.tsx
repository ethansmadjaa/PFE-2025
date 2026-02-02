"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HistoryPanel } from "@/components/HistoryPanel";
import { historyCache } from "@/lib/historyCache";
import JSZip from "jszip";
import { Music4, Upload, Download, Sparkles, Loader2, Check, RefreshCw, Headphones, MessageSquare, Volume2 } from "lucide-react";
import { RemixDialog } from "@/components/RemixDialog";
import Image from "next/image";

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
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [remixTarget, setRemixTarget] = useState<{
    filename: string;
    description: string;
    audioUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from server on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        await historyCache.loadFromServer();
      } catch (err) {
        console.error("Failed to load history from server:", err);
      }
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

  const currentImageRef = useRef<string | null>(null);

  const pollJobStatus = useCallback(
    async (jobId: string): Promise<void> => {
      const pollInterval = 2000;

      const poll = async (): Promise<void> => {
        try {
          const response = await fetch(`/api/sample/${jobId}`);
          const status = await response.json();

          if (!response.ok) {
            throw new Error(status.error || "Failed to get job status");
          }

          setProgress(status.progress);
          setLoadingMessage(status.current_step);

          if (status.status === "completed") {
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

            if (currentImageRef.current) {
              try {
                const entryId = await historyCache.saveEntryWithSync(
                  currentImageRef.current,
                  audioSamples
                );
                setCurrentEntryId(entryId);
                setHistoryCount((prev) => prev + 1);
              } catch (cacheErr) {
                console.error("Failed to save to history:", cacheErr);
              }
            }
          } else if (status.status === "failed") {
            throw new Error(status.error || "Job failed");
          } else {
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

  const handleSelectFromHistory = useCallback(
    (entry: {
      id: string;
      timestamp: number;
      imageUrl: string;
      imageThumbnail: string;
      samples: { filename: string; description: string; audioUrl: string }[];
    }) => {
      samples.forEach((sample) => URL.revokeObjectURL(sample.audioUrl));

      setImagePreview(entry.imageUrl);
      setSamples(entry.samples);
      setError(null);

      // Scroll to studio section so results are visible
      setTimeout(() => {
        document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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

  const handleRemixComplete = useCallback(
    (filename: string, newAudioUrl: string, newDescription: string) => {
      setSamples((prev) =>
        prev.map((s) => {
          if (s.filename === filename) {
            URL.revokeObjectURL(s.audioUrl);
            return { ...s, audioUrl: newAudioUrl, description: newDescription };
          }
          return s;
        })
      );
    },
    []
  );

  const handleReset = useCallback(() => {
    setImagePreview(null);
    setSamples([]);
    setCurrentEntryId(null);
    setError(null);
    samples.forEach((sample) => URL.revokeObjectURL(sample.audioUrl));
  }, [samples]);

  const handleDownload = useCallback(async () => {
    if (samples.length === 0) {
      setError("No samples available for download");
      return;
    }

    try {
      const zip = new JSZip();

      for (const sample of samples) {
        const response = await fetch(sample.audioUrl);
        const blob = await response.blob();
        zip.file(sample.filename, blob);
      }

      const metadata = {
        samples: samples.map((sample) => ({
          filename: sample.filename,
          description: sample.description,
        })),
      };
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `sample_pack_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download");
    }
  }, [samples]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white">
      {/* Background decorative elements */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 animate-pulse-glow pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/50 backdrop-blur-md bg-slate-950/80">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center glow-purple">
              <Music4 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Art to <span className="text-gradient">Audio</span>
              </h1>
              <p className="text-xs text-slate-500">Sample Pack Generator</p>
            </div>
          </div>

          <Button
            size="sm"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 text-slate-200 hover:text-white transition-all"
            onClick={() => setIsHistoryOpen(true)}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
            {historyCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-xs text-white font-bold">
                {historyCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Hero Section - Always visible */}
      <section className="relative pt-20 pb-32 px-6 overflow-hidden">
        <div className="container mx-auto relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/30 border border-purple-500/30 text-purple-300 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            Nouvelle frontière de la création sonore
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            Traduire l&apos;Invisible : <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 via-pink-400 to-orange-400">
              De la Toile à l&apos;Onde
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Nous transformons l&apos;univers pictural des artistes en <span className="text-white font-medium">matière sonore brute</span>.
            Une palette audio générée par IA pour inspirer compositeurs et créateurs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#studio" className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-bold transition-all shadow-lg shadow-purple-900/50 flex items-center justify-center gap-2 glow-purple">
              <Sparkles size={20} />
              Essayer le Studio
            </a>
            <a href="#concept" className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold transition-all border border-slate-700 flex items-center justify-center gap-2">
              Comprendre le Concept
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Concept Section */}
      <section id="concept" className="py-24 bg-slate-900/50 backdrop-blur-sm relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-slate-950 border border-slate-800 rounded-2xl p-8 aspect-square flex flex-col justify-center items-center text-center overflow-hidden">
                <div className="flex items-center justify-between w-full mb-8">
                  <svg className="h-12 w-12 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div className="flex-1 h-1 bg-slate-800 mx-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-r from-pink-500 to-blue-500 w-1/2 animate-shimmer"></div>
                  </div>
                  <Music4 size={48} className="text-blue-500" />
                </div>
                <div className="space-y-4 w-full">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-[70%] bg-pink-500/50"></div>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-[40%] bg-purple-500/50"></div>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-[90%] bg-blue-500/50"></div>
                  </div>
                </div>
                <p className="mt-8 text-sm text-slate-500 font-mono">Analysis_v4.2 // Extraction de texture</p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Pas une musique finie, mais une <span className="text-purple-400">cartouche de couleur</span>.</h2>
              <p className="text-slate-400 text-lg mb-6 leading-relaxed">
                GenAI-Picto-Music ne remplace pas le compositeur. Nous créons l&apos;instrument. Imaginez extraire l&apos;essence d&apos;un tableau de Soulages pour obtenir une basse profonde et texturée, ou d&apos;un Monet pour des nappes aigües et scintillantes.
              </p>
              <ul className="space-y-4">
                {[
                  "Analyse colorimétrique et structurelle de l'œuvre.",
                  "Traduction des émotions biographiques en paramètres sonores.",
                  "Génération de samples WAV bruts (Stems) prêts à l'emploi.",
                  "Intégration facile dans tous les DAW (Ableton, Logic, etc.)."
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 bg-slate-950">
        <div className="container mx-auto px-6 text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Notre Processus Algorithmique</h2>
          <p className="text-slate-400">Du visuel au sonore en trois étapes clés.</p>
        </div>

        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: (
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              ),
              title: "Ingestion des Données",
              desc: "Nous scannons les œuvres (haute résolution) et ingérons les biographies, notes et esquisses de l'artiste."
            },
            {
              icon: (
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ),
              title: "Synthèse IA",
              desc: "Nos modèles neuronaux traduisent la densité, le trait et la couleur en timbres, fréquences et rythmiques."
            },
            {
              icon: <Music4 size={32} />,
              title: "Output Créatif",
              desc: "Livraison d'une banque de sons (Soundbank) unique, cohérente avec l'ADN de l'artiste source."
            }
          ].map((step, idx) => (
            <div key={idx} className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 hover:border-purple-500/50 transition-colors group">
              <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-slate-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Remix Feature Section */}
      <section className="py-24 bg-slate-900/50 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-1/2 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="container mx-auto px-6 text-center max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-900/30 border border-purple-500/30 text-purple-300 text-sm mb-6">
            <RefreshCw className="h-3 w-3" />
            Nouveau
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Affinez Votre Son avec le{" "}
            <span className="text-purple-400">Remix</span>
          </h2>
          <p className="text-slate-400 text-lg mb-12 leading-relaxed">
            Pas satisfait d&apos;un sample ? Dites-nous ce que vous voulez changer,
            et notre IA regénère une version améliorée en gardant l&pos;essence de votre oeuvre.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Headphones className="h-6 w-6" />,
                title: "Écoutez",
                desc: "Identifiez le sample que vous souhaitez améliorer.",
              },
              {
                icon: <MessageSquare className="h-6 w-6" />,
                title: "Décrivez",
                desc: "Exprimez ce que vous aimeriez changer : plus de reverb, tempo différent, texture plus granulaire...",
              },
              {
                icon: <Volume2 className="h-6 w-6" />,
                title: "Recevez",
                desc: "L'IA génère une nouvelle version. Les anciennes restent accessibles via le versioning.",
              },
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center text-purple-400 border border-slate-700">
                  {step.icon}
                </div>
                <h3 className="font-bold text-lg">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Studio Section */}
      <main id="studio" className="container mx-auto px-6 py-24 relative z-10">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Essayez le Studio</h2>
          <p className="text-slate-400">Uploadez votre œuvre et laissez l&pos;IA générer votre palette sonore unique.</p>
        </div>

        {/* Upload Area */}
        {!imagePreview && !isLoading && (
          <Card
            className={`cursor-pointer transition-all duration-300 border-2 border-dashed max-w-2xl mx-auto ${isDragOver
              ? "border-purple-500 bg-purple-500/10 scale-105 glow-purple"
              : "border-slate-700 hover:border-purple-500/50 bg-slate-900/50 backdrop-blur-sm"
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="mb-6 p-6 rounded-2xl bg-linear-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm">
                <Upload className="h-12 w-12 text-purple-400" />
              </div>
              <p className="text-xl font-semibold mb-2">Drop your artwork here</p>
              <p className="text-slate-400 mb-6">or click to browse</p>
              <div className="flex gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 rounded bg-slate-800">PNG</span>
                <span className="px-2 py-1 rounded bg-slate-800">JPG</span>
                <span className="px-2 py-1 rounded bg-slate-800">WEBP</span>
                <span className="px-2 py-1 rounded bg-slate-800">up to 10MB</span>
              </div>
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

        {/* Loading State */}
        {isLoading && (
          <Card className="max-w-3xl mx-auto bg-slate-900/50 backdrop-blur-sm border-slate-800">
            <CardContent className="py-12">
              <div className="flex flex-col items-center">
                {imagePreview && (
                  <div className="mb-8 relative group">
                    <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                    <Image
                      src={imagePreview}
                      width={100}
                      height={100}
                      alt="Uploaded artwork"
                      className="relative max-h-48 rounded-xl object-contain opacity-90"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                  <p className="text-lg font-medium">{loadingMessage}</p>
                </div>

                <Progress value={progress} className="w-full max-w-md mb-4 h-2" />

                <p className="text-center text-sm text-slate-400 mb-8">
                  This may take a few minutes. We&pos;re generating 10 unique audio samples based on your artwork.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full max-w-2xl">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        {i < Math.floor(progress / 10) ? (
                          <Check className="h-5 w-5 text-green-400" />
                        ) : (
                          <span className="text-sm text-slate-500">{i + 1}</span>
                        )}
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="max-w-2xl mx-auto border-red-900/50 bg-red-950/20">
            <CardContent className="py-8 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button variant="outline" onClick={handleReset} className="border-red-800 hover:border-red-600">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {samples.length > 0 && (
          <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 rounded-xl blur-md opacity-30"></div>
                    <Image
                      src={imagePreview}
                      alt="Source artwork"
                      className="relative h-20 w-20 rounded-xl object-cover"
                      width={100}
                      height={100}
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                    <h2 className="text-2xl font-bold">Your Sample Pack is Ready</h2>
                  </div>
                  <p className="text-slate-400">
                    {samples.length} audio samples generated
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-500 glow-purple">
                  <Download className="mr-2 h-4 w-4" />
                  Download Pack
                </Button>
                <Button variant="outline" onClick={handleReset} className="border-slate-700 hover:border-slate-600">
                  Create New
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {samples.map((sample, index) => (
                <Card key={sample.filename} className="overflow-hidden bg-slate-900/50 backdrop-blur-sm border-slate-800 hover:border-slate-700 transition-all group">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="font-mono text-sm text-slate-300">{sample.filename}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-slate-400 leading-relaxed line-clamp-2">
                      {sample.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <audio
                        controls
                        className="w-full"
                        src={sample.audioUrl}
                        preload="metadata"
                      >
                        Your browser does not support the audio element.
                      </audio>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8 px-2 border-slate-700 hover:border-purple-500 hover:text-purple-400"
                        onClick={() => setRemixTarget(sample)}
                        title="Remix this sample"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-linear-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Music4 size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-500">
              GenAI<span className="text-slate-300">Picto</span>Music
            </span>
          </div>
          <div className="text-slate-600 text-sm">
            © 2024 GenAI-Picto-Music. Tous droits réservés. Innovation par l&pos;IA.
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">Twitter</a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors">LinkedIn</a>
          </div>
        </div>
      </footer>

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectEntry={handleSelectFromHistory}
      />

      <RemixDialog
        isOpen={!!remixTarget}
        onClose={() => setRemixTarget(null)}
        sample={remixTarget}
        entryId={currentEntryId}
        onRemixComplete={handleRemixComplete}
      />
    </div>
  );
}
