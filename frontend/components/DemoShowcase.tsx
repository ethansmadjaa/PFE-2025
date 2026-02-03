"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

export function DemoShowcase() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

    useEffect(() => {
        setIsMounted(true);
        // Initialize audio context on user interaction (or first mount if allowed, but usually needs interaction)
        // We'll initialize it when play is clicked to be safe with browser policies
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    const initAudioContext = () => {
        if (!audioRef.current || analyserRef.current) return;

        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();

        const source = audioContext.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        analyser.fftSize = 256;
        analyserRef.current = analyser;
        sourceRef.current = source;
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const renderFrame = () => {
            animationRef.current = requestAnimationFrame(renderFrame);
            analyserRef.current!.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const width = canvas.width;
            const height = canvas.height;
            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * height; // Normalize to canvas height

                // Create gradient
                const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                gradient.addColorStop(0, "#a855f7"); // Purple 500
                gradient.addColorStop(1, "#ec4899"); // Pink 500

                ctx.fillStyle = gradient;

                // Draw rounded bars
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth, barHeight, 4);
                ctx.fill();

                x += barWidth + 2;
            }
        };

        renderFrame();
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        } else {
            initAudioContext();
            // Resume context if suspended (common browser policy)
            if ((sourceRef.current?.context as AudioContext).state === 'suspended') {
                await (sourceRef.current!.context as AudioContext).resume();
            }

            try {
                await audioRef.current.play();
                draw();
            } catch (err) {
                console.error("Playback failed:", err);
            }
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="flex flex-col xl:flex-row gap-12 items-center justify-center">

                    {/* Image Section - Full Size/Original aspect ratio but responsive */}
                    <div className="relative group max-w-2xl w-full">
                        <div className="absolute -inset-1 bg-linear-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-30 group-hover:opacity-50 transition-duration-500 transition-opacity"></div>
                        <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-purple-900/20 border border-slate-800 bg-slate-900">
                            <div className="flex justify-center p-8 bg-black/20">
                                <Image
                                    src="/demo/monnet.jpeg"
                                    alt="Le Bassin aux Nympheas - Claude Monet"
                                    width={228}
                                    height={221}
                                    className="w-auto h-auto rounded-lg shadow-lg"
                                    priority
                                    unoptimized
                                />
                            </div>

                            {/* Legend Below */}
                            <div className="p-6 bg-slate-900 border-t border-slate-800">
                                <h3 className="text-xl font-bold text-white mb-2">Le Bassin aux Nympheas</h3>
                                <p className="text-slate-400 text-sm font-light leading-relaxed">
                                    Claude Monet 1899, 90×90 cm, Art Museum, Princeton University, Princeton, New Jersey
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Audio Visualization Section */}
                    <div className="w-full xl:w-[500px] flex flex-col gap-6">
                        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-xl">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-purple-400 animate-pulse">
                                        <Volume2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Composition #01</h4>
                                        <p className="text-xs text-slate-500 uppercase tracking-widest">Génération IA • Claude Monet</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={toggleMute}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                    </Button>
                                </div>
                            </div>

                            {/* Canvas Visualizer */}
                            <div className="h-48 w-full bg-slate-950 rounded-xl border border-slate-800 mb-6 relative overflow-hidden flex items-end px-2">
                                <canvas
                                    ref={canvasRef}
                                    width={430}
                                    height={192}
                                    className="w-full h-full"
                                />

                                {/* Placeholder lines if not playing */}
                                {!isPlaying && isMounted && (
                                    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-20">
                                        {[...Array(20)].map((_, i) => (
                                            <div key={i} className="w-2 bg-slate-500 rounded-full" style={{ height: `${20 + Math.random() * 40}%` }}></div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={togglePlay}
                                    className={`w-full py-6 text-lg font-bold rounded-xl transition-all ${isPlaying ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50 glow-purple'}`}
                                >
                                    {isPlaying ? (
                                        <>
                                            <Pause className="mr-2" fill="currentColor" /> Pause
                                        </>
                                    ) : (
                                        <>
                                            <Play className="mr-2" fill="currentColor" /> Écouter l'Interprétation
                                        </>
                                    )}
                                </Button>
                            </div>

                            <audio
                                ref={audioRef}
                                src="/demo/monnet.wav"
                                onEnded={() => setIsPlaying(false)}
                                loop={false}
                                crossOrigin="anonymous"
                            />
                        </div>

                        {/* Extra Context */}
                        <div className="p-6 rounded-2xl bg-purple-900/10 border border-purple-500/20 text-sm text-slate-400 leading-relaxed">
                            <p>
                                <span className="text-purple-300 font-bold block mb-1">Note de l'artiste :</span>
                                "Cette composition utilise les variations chromatiques des nénuphars pour générer des nappes synthétiques évolutives, tandis que la structure du pont dicte la progression rythmique."
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
