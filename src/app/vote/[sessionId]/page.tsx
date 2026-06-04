"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Session } from "@/lib/types";

const WORD_REGEX = /^[a-zA-Z0-9]+$/;
const POLL_INTERVAL = 2000;

export default function VotePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [word, setWord] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const lastIterationRef = useRef(0);
  const [error, setError] = useState("");

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (!data) return;
    const updated = data as Session;

    setSession((prev) => {
      if (
        prev &&
        prev.status === updated.status &&
        prev.current_iteration === updated.current_iteration &&
        prev.current_sentence === updated.current_sentence
      ) {
        return prev;
      }
      if (updated.current_iteration !== lastIterationRef.current) {
        setSubmitted(false);
        setWord("");
        setError("");
      }
      return updated;
    });
  }, [sessionId]);

  useEffect(() => {
    fetchSession();

    const interval = setInterval(fetchSession, POLL_INTERVAL);

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchSession]);

  async function submitVote() {
    if (!word.trim() || !session) return;

    const cleanWord = word.trim();

    if (!WORD_REGEX.test(cleanWord)) {
      setError("Only letters and numbers allowed — no spaces or special characters");
      return;
    }

    const { error: insertError } = await supabase.from("votes").insert({
      session_id: sessionId,
      iteration: session.current_iteration,
      word: cleanWord.toLowerCase(),
    });

    if (insertError) {
      setError("Failed to submit vote. Try again.");
      return;
    }

    setSubmitted(true);
    lastIterationRef.current = session.current_iteration;
    setError("");
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (session.status === "completed") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <span className="text-3xl">&#10003;</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Session Complete!</h1>
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 max-w-sm">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              Final Sentence
            </p>
            <p className="text-xl font-medium text-indigo-300">
              {session.current_sentence || "No words added"}
            </p>
          </div>
          <p className="text-zinc-500 text-sm">Thanks for participating!</p>
        </motion.div>
      </div>
    );
  }

  if (session.status === "waiting") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"
          >
            <span className="text-3xl">&#9203;</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white">
            Waiting for the presenter...
          </h1>
          <p className="text-zinc-400">
            Voting will open shortly. Stay on this page.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col flex-1 max-w-md mx-auto w-full gap-6"
      >
        {/* Header */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Iteration {session.current_iteration}
          </p>
          <h1 className="text-2xl font-bold text-white mt-2">
            What comes next?
          </h1>
        </div>

        {/* Current Sentence */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
            Current Sentence
          </p>
          <div className="flex flex-wrap gap-2 min-h-[40px] items-center">
            {session.current_sentence ? (
              session.current_sentence.split(" ").map((w, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-lg font-medium text-indigo-300"
                >
                  {w}
                </span>
              ))
            ) : (
              <span className="text-zinc-500 italic">
                Empty — you pick the first word!
              </span>
            )}
            <motion.span
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="px-3 py-1.5 border-2 border-dashed border-indigo-500/50 rounded-lg text-lg text-indigo-400"
            >
              ?
            </motion.span>
          </div>
        </div>

        {/* Vote Input */}
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center space-y-3"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-2xl text-green-400">&#10003;</span>
              </div>
              <p className="text-green-400 font-semibold text-lg">
                Vote submitted!
              </p>
              <p className="text-zinc-500 text-sm">
                Waiting for the next iteration...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              <div className="relative">
                <input
                  type="text"
                  value={word}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || WORD_REGEX.test(val)) {
                      setWord(val);
                      setError("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitVote();
                  }}
                  placeholder="Type one word..."
                  maxLength={30}
                  autoFocus
                  className="w-full px-6 py-5 bg-white/5 border border-white/20 rounded-2xl text-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={submitVote}
                disabled={!word.trim()}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-xl font-semibold shadow-xl hover:shadow-indigo-500/25 transition-all disabled:opacity-30 cursor-pointer"
              >
                Submit Vote
              </motion.button>

              <p className="text-xs text-zinc-600 text-center">
                Letters and numbers only. No spaces or special characters.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
