"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import { RefreshCw, Headphones, MessageSquare, Volume2 } from "lucide-react";

const remixSteps = [
  {
    icon: <Headphones className="h-6 w-6" />,
    title: "Écoutez",
    desc: "Identifiez le sample que vous souhaitez améliorer.",
    gradient: "from-emerald-500 to-teal-500",
    shadowColor: "shadow-emerald-500/10",
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Décrivez",
    desc: "Exprimez ce que vous aimeriez changer : plus de reverb, tempo différent, texture plus granulaire...",
    gradient: "from-purple-500 to-fuchsia-500",
    shadowColor: "shadow-purple-500/10",
  },
  {
    icon: <Volume2 className="h-6 w-6" />,
    title: "Recevez",
    desc: "L'IA génère une nouvelle version. Les anciennes restent accessibles via le versioning.",
    gradient: "from-amber-500 to-orange-500",
    shadowColor: "shadow-amber-500/10",
  },
];

function WaveformBackground() {
  const [bars, setBars] = useState<{ height: number; delay: number }[]>([]);

  useEffect(() => {
    // Generate bars only on client side to avoid hydration mismatch
    const newBars = Array.from({ length: 60 }, (_, i) => {
      const height = 20 + Math.sin(i * 0.3) * 15 + Math.random() * 25;
      return { height, delay: i * 0.04 };
    });
    setBars(newBars);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient mesh */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.04]">
        <div className="absolute inset-0 rounded-full bg-purple-600 blur-[150px]" />
        <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-teal-500 blur-[120px]" />
        <div className="absolute -bottom-10 right-10 w-80 h-80 rounded-full bg-amber-500 blur-[130px]" />
      </div>

      {/* Waveform bars at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[3px] px-8 opacity-[0.06]">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="w-1.5 rounded-t-full bg-purple-400 animate-waveform"
            style={{
              height: `${bar.height}%`,
              animationDelay: `${bar.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function RemixStepCard({
  step,
  index,
}: {
  step: (typeof remixSteps)[number];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      className="relative"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 30, scale: 0.95 }
      }
      transition={{
        duration: 0.5,
        delay: 0.15 + index * 0.15,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className={`group relative flex flex-col items-center text-center p-8 rounded-2xl
          border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm
          hover:border-slate-700/80 hover:bg-slate-900/60 transition-all duration-500
          hover:shadow-2xl ${step.shadowColor}`}
      >
        {/* Step number pill */}
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[0.7rem] font-mono text-slate-500 tracking-wider">
          ÉTAPE {index + 1}
        </span>

        {/* Animated icon */}
        <motion.div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center text-white mb-5 shadow-lg`}
          whileHover={{ scale: 1.12, rotate: 8 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          {step.icon}
        </motion.div>

        <h3 className="text-lg font-bold mb-2 text-slate-100">{step.title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed max-w-[240px]">
          {step.desc}
        </p>

        {/* Bottom decorative bar */}
        <div
          className={`mt-5 h-0.5 w-0 rounded-full bg-gradient-to-r ${step.gradient} group-hover:w-12 transition-all duration-700`}
        />
      </div>
    </motion.div>
  );
}

export function RemixSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section className="py-28 bg-slate-900/50 backdrop-blur-sm relative overflow-hidden">
      <WaveformBackground />

      <div
        ref={sectionRef}
        className="container mx-auto px-6 text-center max-w-4xl relative z-10"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-900/30 border border-purple-500/30 text-purple-300 text-sm mb-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </motion.div>
          Nouveau
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-4xl md:text-5xl font-extrabold mb-5 tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Affinez Votre Son avec le{" "}
          <span className="relative inline-block">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">
              Remix
            </span>
            {/* Underline glow */}
            <motion.span
              className="absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 rounded-full"
              initial={{ width: "0%" }}
              animate={isInView ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            />
          </span>
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-slate-400 text-lg mb-16 leading-relaxed max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Pas satisfait d&apos;un sample ? Dites-nous ce que vous voulez changer,
          et notre IA regénère une version améliorée en gardant l&apos;essence de
          votre œuvre.
        </motion.p>

        {/* Animated connector line (mobile: vertical, desktop: horizontal) */}
        <div className="relative">
          {/* Desktop horizontal connector behind cards */}
          <div className="hidden md:block absolute top-1/2 left-[16%] right-[16%] -translate-y-1/2 z-0">
            <div className="h-px bg-slate-800 w-full" />
            <motion.div
              className="absolute inset-y-0 left-0 h-px bg-gradient-to-r from-emerald-500/50 via-purple-500/50 to-amber-500/50"
              initial={{ width: "0%" }}
              animate={isInView ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: 1.5, delay: 0.6, ease: "easeOut" }}
            />
          </div>

          {/* Cards grid */}
          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {remixSteps.map((step, idx) => (
              <RemixStepCard key={idx} step={step} index={idx} />
            ))}
          </div>
        </div>

        {/* CTA hint */}
        <motion.div
          className="mt-16 flex items-center justify-center gap-3 text-slate-600 text-sm"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <div className="h-px w-12 bg-slate-800" />
          <span className="font-mono tracking-wide">
            Cliquez sur{" "}
            <RefreshCw className="inline h-3 w-3 text-purple-500" /> dans le
            studio pour remixer
          </span>
          <div className="h-px w-12 bg-slate-800" />
        </motion.div>
      </div>
    </section>
  );
}
