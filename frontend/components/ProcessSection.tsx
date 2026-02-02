"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Music4 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
        />
      </svg>
    ),
    title: "Ingestion des Données",
    desc: "Nous scannons les œuvres (haute résolution) et ingérons les biographies, notes et esquisses de l'artiste.",
    accent: "from-pink-500 to-rose-500",
    accentColor: "rgb(236, 72, 153)",
    glowClass: "shadow-pink-500/20",
  },
  {
    number: "02",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    title: "Synthèse IA",
    desc: "Nos modèles neuronaux traduisent la densité, le trait et la couleur en timbres, fréquences et rythmiques.",
    accent: "from-purple-500 to-violet-500",
    accentColor: "rgb(168, 85, 247)",
    glowClass: "shadow-purple-500/20",
  },
  {
    number: "03",
    icon: <Music4 size={28} />,
    title: "Output Créatif",
    desc: "Livraison d'une banque de sons (Soundbank) unique, cohérente avec l'ADN de l'artiste source.",
    accent: "from-blue-500 to-cyan-500",
    accentColor: "rgb(59, 130, 246)",
    glowClass: "shadow-blue-500/20",
  },
];

function AnimatedGridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(168, 85, 247) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Horizontal scan line */}
      <div className="absolute inset-0">
        <div className="absolute w-full h-px bg-linear-to-r from-transparent via-purple-500/20 to-transparent animate-scan-line" />
      </div>
    </div>
  );
}

function ConnectorLine({ index }: { index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div
      ref={ref}
      className="hidden md:flex items-center justify-center shrink-0 w-16 lg:w-24"
    >
      <div className="relative w-full h-px">
        {/* Background track */}
        <div className="absolute inset-0 bg-slate-800" />
        {/* Animated fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-linear-to-r from-purple-500 to-blue-500"
          initial={{ width: "0%" }}
          animate={isInView ? { width: "100%" } : { width: "0%" }}
          transition={{ duration: 0.8, delay: 0.3 + index * 0.3, ease: "easeOut" }}
        />
        {/* Animated dot traveling along the line */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-purple-400"
          initial={{ left: "0%", opacity: 0 }}
          animate={
            isInView
              ? { left: ["0%", "100%"], opacity: [0, 1, 1, 0] }
              : { left: "0%", opacity: 0 }
          }
          transition={{
            duration: 1.2,
            delay: 0.5 + index * 0.3,
            ease: "easeInOut",
          }}
          style={{ filter: "blur(1px)" }}
        />
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
}: {
  step: (typeof steps)[number];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="relative flex-1 min-w-0"
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        duration: 0.6,
        delay: index * 0.2,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className={`group relative rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-8 h-full
          hover:border-slate-700 transition-all duration-500 hover:shadow-2xl ${step.glowClass}`}
      >
        {/* Step number — large watermark */}
        <span className="absolute top-4 right-5 text-7xl font-black text-slate-800/40 select-none leading-none tracking-tighter">
          {step.number}
        </span>

        {/* Icon container */}
        <motion.div
          className={`relative z-10 w-14 h-14 rounded-xl bg-linear-to-br ${step.accent} flex items-center justify-center text-white mb-6`}
          whileHover={{ scale: 1.1, rotate: -5 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {step.icon}
        </motion.div>

        {/* Glowing bar under icon on hover */}
        <div
          className={`h-0.5 w-10 rounded-full bg-linear-to-r ${step.accent} opacity-0 group-hover:opacity-100 group-hover:w-16 transition-all duration-500 mb-5`}
        />

        <h3 className="relative z-10 text-xl font-bold mb-3 text-slate-100 tracking-tight">
          {step.title}
        </h3>
        <p className="relative z-10 text-slate-400 leading-relaxed text-[0.95rem]">
          {step.desc}
        </p>
      </div>
    </motion.div>
  );
}

export function ProcessSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section id="process" className="py-28 bg-slate-950 relative overflow-hidden">
      <AnimatedGridBackground />

      <div ref={sectionRef} className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-slate-400 text-sm mb-5 font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            process.execute()
          </motion.div>

          <motion.h2
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Notre Processus{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-blue-400">
              Algorithmique
            </span>
          </motion.h2>

          <motion.p
            className="text-slate-500 text-lg max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Du visuel au sonore en trois étapes clés.
          </motion.p>
        </div>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col md:flex-row items-stretch gap-6 md:gap-0">
          {steps.map((step, idx) => (
            <div key={idx} className="contents">
              <StepCard step={step} index={idx} />
              {idx < steps.length - 1 && <ConnectorLine index={idx} />}
            </div>
          ))}
        </div>

        {/* Bottom accent bar */}
        <motion.div
          className="mt-16 h-px w-full bg-linear-to-r from-transparent via-purple-500/30 to-transparent"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
        />
      </div>
    </section>
  );
}
