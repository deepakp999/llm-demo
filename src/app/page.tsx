"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createSession() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .insert({ title: "LLM Demo", status: "waiting" })
      .select()
      .single();

    if (error || !data) {
      alert("Failed to create session");
      setLoading(false);
      return;
    }

    router.push(`/present?session=${data.id}`);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 animate-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_50%)]" />

      <motion.main
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-8 px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl"
        >
          <span className="text-4xl font-bold text-white font-mono">AI</span>
        </motion.div>

        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">
            LLM Word Predictor
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Experience how Large Language Models predict the next word.
            Vote together and build a sentence — one word at a time.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={createSession}
          disabled={loading}
          className="mt-4 px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-semibold rounded-2xl shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Creating Session..." : "Start a New Session"}
        </motion.button>

        <p className="text-sm text-zinc-500 mt-8">
          Create a session, share the QR code, and let participants vote!
        </p>
      </motion.main>
    </div>
  );
}
