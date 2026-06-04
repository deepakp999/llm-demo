"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import type { Session, WordCount } from "@/lib/types";

export default function PresenterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-slate-950">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PresenterContent />
    </Suspense>
  );
}

function PresenterContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState<Session | null>(null);
  const [votes, setVotes] = useState<WordCount[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [sentenceHistory, setSentenceHistory] = useState<string[]>([]);
  const [openingWord, setOpeningWord] = useState("");
  const [revealed, setRevealed] = useState(false);

  const fetchVotes = useCallback(async () => {
    if (!sessionId || !session) return;
    const { data } = await supabase
      .from("votes")
      .select("word")
      .eq("session_id", sessionId)
      .eq("iteration", session.current_iteration);

    if (!data) return;

    const counts: Record<string, number> = {};
    data.forEach((v) => {
      const w = v.word.toLowerCase();
      counts[w] = (counts[w] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);

    setVotes(sorted);
    setTotalVotes(data.length);
  }, [sessionId, session]);

  useEffect(() => {
    if (!sessionId) return;

    async function loadSession() {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (data) {
        setSession(data as Session);
        if (data.current_sentence) {
          setSentenceHistory(data.current_sentence.split(" "));
        }
      }
    }

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;

    fetchVotes();

    const interval = setInterval(fetchVotes, 2000);

    const channel = supabase
      .channel(`votes-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "votes",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          fetchVotes();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionId, session, fetchVotes]);

  async function startVoting() {
    if (!sessionId || !openingWord.trim()) return;
    const word = openingWord.trim().toLowerCase();
    await supabase
      .from("sessions")
      .update({
        status: "voting",
        current_sentence: word,
      })
      .eq("id", sessionId);
    setSentenceHistory([word]);
    setSession((s) =>
      s ? { ...s, status: "voting", current_sentence: word } : s
    );
  }

  function revealVotes() {
    setRevealed(true);
  }

  async function acceptWord() {
    if (!votes.length || !sessionId || !session) return;

    const winningWord = votes[0].word;
    const newSentence = session.current_sentence
      ? `${session.current_sentence} ${winningWord}`
      : winningWord;
    const newIteration = session.current_iteration + 1;

    await supabase
      .from("sessions")
      .update({
        current_sentence: newSentence,
        current_iteration: newIteration,
        status: "voting",
      })
      .eq("id", sessionId);

    setSentenceHistory((prev) => [...prev, winningWord]);
    setSession((s) =>
      s
        ? {
            ...s,
            current_sentence: newSentence,
            current_iteration: newIteration,
          }
        : s
    );
    setVotes([]);
    setTotalVotes(0);
    setRevealed(false);
  }

  async function endSession() {
    if (!sessionId) return;
    await supabase
      .from("sessions")
      .update({ status: "completed" })
      .eq("id", sessionId);
    setSession((s) => (s ? { ...s, status: "completed" } : s));
  }

  const voteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/vote/${sessionId}`
      : "";

  const maxCount = votes.length > 0 ? votes[0].count : 1;

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-950 text-white text-xl">
        No session ID provided
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-lg font-bold font-mono">AI</span>
          </div>
          <h1 className="text-xl font-semibold">LLM Word Predictor</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            Iteration{" "}
            <span className="text-indigo-400 font-mono font-bold text-lg">
              {session?.current_iteration || 1}
            </span>
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              session?.status === "voting"
                ? "bg-green-500/20 text-green-400"
                : session?.status === "completed"
                ? "bg-red-500/20 text-red-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {session?.status === "voting"
              ? "Voting Open"
              : session?.status === "completed"
              ? "Completed"
              : "Waiting"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col p-8 gap-6 overflow-y-auto">
          {/* Sentence Display */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
              Generated Sentence
            </p>
            <div className="flex flex-wrap gap-2 min-h-[60px] items-center">
              <AnimatePresence>
                {sentenceHistory.map((word, i) => (
                  <motion.span
                    key={`${i}-${word}`}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-xl md:text-2xl font-medium"
                  >
                    {word}
                  </motion.span>
                ))}
              </AnimatePresence>
              {session?.status === "voting" && (
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="px-4 py-2 border-2 border-dashed border-indigo-500/50 rounded-xl text-xl md:text-2xl text-indigo-400"
                >
                  ?
                </motion.span>
              )}
            </div>
          </div>

          {/* Vote Results */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 flex-1">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                {revealed ? "Vote Results" : "Votes"}
              </p>
              <span className="text-sm text-zinc-400">
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
              </span>
            </div>

            {!revealed ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                {totalVotes === 0 ? (
                  <>
                    <p className="text-lg">Waiting for votes...</p>
                    <p className="text-sm mt-1">
                      Participants can scan the QR code to join
                    </p>
                  </>
                ) : (
                  <>
                    <motion.p
                      key={totalVotes}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      className="text-5xl font-bold text-indigo-400 font-mono"
                    >
                      {totalVotes}
                    </motion.p>
                    <p className="text-lg mt-2 text-zinc-400">
                      vote{totalVotes !== 1 ? "s" : ""} received — click Reveal
                      to see results
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {votes.slice(0, 10).map((v, i) => (
                    <motion.div
                      key={v.word}
                      layout
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4"
                    >
                      <span className="w-8 text-right text-zinc-500 font-mono text-sm">
                        {i + 1}
                      </span>
                      <div className="flex-1 relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(v.count / maxCount) * 100}%`,
                          }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={`h-12 rounded-xl ${
                            i === 0
                              ? "bg-gradient-to-r from-indigo-600 to-purple-600"
                              : "bg-white/10"
                          }`}
                        />
                        <div className="absolute inset-0 flex items-center px-4 justify-between">
                          <span
                            className={`font-medium text-lg ${
                              i === 0 ? "text-white" : "text-zinc-300"
                            }`}
                          >
                            {v.word}
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              i === 0 ? "text-white" : "text-zinc-400"
                            }`}
                          >
                            {v.count}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-4">
            {session?.status === "waiting" && (
              <div className="flex gap-4 items-center w-full">
                <input
                  type="text"
                  value={openingWord}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[a-zA-Z0-9]+$/.test(val)) {
                      setOpeningWord(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startVoting();
                  }}
                  placeholder="Enter the opening word..."
                  className="flex-1 px-6 py-4 bg-white/5 border border-white/20 rounded-xl text-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startVoting}
                  disabled={!openingWord.trim()}
                  className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl text-lg font-semibold hover:shadow-green-500/25 shadow-xl transition-all disabled:opacity-30 cursor-pointer"
                >
                  Start Voting
                </motion.button>
              </div>
            )}
            {session?.status === "voting" && (
              <>
                {!revealed ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={revealVotes}
                    disabled={totalVotes === 0}
                    className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-lg font-semibold hover:shadow-indigo-500/25 shadow-xl transition-all disabled:opacity-30 cursor-pointer"
                  >
                    Reveal Votes
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={acceptWord}
                    disabled={votes.length === 0}
                    className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl text-lg font-semibold hover:shadow-green-500/25 shadow-xl transition-all disabled:opacity-30 cursor-pointer"
                  >
                    Accept &quot;{votes[0]?.word}&quot; &amp; Next Iteration
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={endSession}
                  className="px-8 py-4 bg-red-600/20 border border-red-500/30 rounded-xl text-lg font-semibold text-red-400 hover:bg-red-600/30 transition-all cursor-pointer"
                >
                  End Session
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* QR Code Sidebar */}
        <aside className="w-72 border-l border-white/10 p-6 flex flex-col items-center gap-6 bg-white/[0.02]">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Scan to Join
          </p>
          {voteUrl && (
            <div className="bg-white rounded-2xl p-4 shadow-2xl">
              <QRCodeSVG
                value={voteUrl}
                size={200}
                level="H"
                bgColor="#ffffff"
                fgColor="#1e1b4b"
              />
            </div>
          )}
          <p className="text-xs text-zinc-500 text-center break-all">
            {voteUrl}
          </p>
          <div className="mt-auto text-center">
            <p className="text-xs text-zinc-600">Session ID</p>
            <p className="text-xs font-mono text-zinc-400 break-all mt-1">
              {sessionId}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
