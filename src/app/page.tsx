"use client";
import { useEffect, useRef, useState } from "react";
import type { AnalysisResponse } from "@/types/analysis";
import VisualCoachingReport from "./components/VisualCoachingReport";

type ModelOption = {
  provider: "openai" | "gemini";
  id: string;
  name: string;
  displayName: string;
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<"openai" | "gemini">(
    "gemini"
  );
  const [mode, setMode] = useState<"video" | "audio">("video");
  const DEFAULT_PROMPT =
    "Please analyze this video and provide: summary, main topics, sentiment, and key takeaways with timestamps if available.";

  const VISUAL_COACHING_PROMPT = `Please analyze the video/audio and return a structured Visual Coaching Report in JSON ONLY (no markdown, no explanation) with the exact fields:
  {
    "toneWarmth": number (0-10),
    "score": number (0-100),
    "badge": string (one of: "🚫 Needs Support","🌼 Growing","🌸 Friendly","🌺 Caring Expert"),
    "trainingMeaning": string,
    "voiceRecipe": [ {"ingredient": string, "tip": string}, ... 3 items ],
    "audioStyles": { "tryIt": [string], "dontTry": [string] },
    "practiceExercise": string,
    "empathyGoal": string
  }
  Please ensure voiceRecipe contains exactly 3 actionable items.
`;

  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [isDevMode, setIsDevMode] = useState<boolean>(true);

  useEffect(() => {
    // fetch models once
    async function loadModels() {
      try {
        const res = await fetch("/api/models");
        const json = await res.json();
        if (json?.models) setModels(json.models);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    if (models.length && !selectedModel) {
      const first = models.find((m) => m.provider === "gemini");
      if (first) {
        setSelectedModel(first.id);
        setSelectedProvider(first.provider);
      }
    }
  }, [models, selectedModel]);

  useEffect(() => {
    if (models.length) {
      const first = models.find((m) => m.provider === selectedProvider);
      if (first) setSelectedModel(first.id);
    }
  }, [models, selectedProvider]);

  async function startRecording() {
    setResult(null);
    setVideoBlob(null);
    const constraints = {
      audio: true,
      video: mode === "video",
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (videoRef.current) {
      // Clean up any previous src to avoid audio echo
      videoRef.current.src = "";
      videoRef.current.removeAttribute("src");
      videoRef.current.controls = false;
      videoRef.current.muted = true;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    const options = { mimeType: "video/webm" } as MediaRecorderOptions;
    const recorder = new MediaRecorder(stream, options);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setVideoBlob(blob);
      // stop tracks
      stream.getTracks().forEach((t) => {
        t.stop();
      });
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function submitAnalysis() {
    if (!videoBlob || !selectedModel || !selectedProvider) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", videoBlob, "recording.webm");
    fd.append("provider", selectedProvider);
    fd.append("model", selectedModel);
    fd.append("prompt", prompt);
    fd.append("mediaType", mode);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setResult({ analysis: "Error contacting analysis service" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900 p-6 text-zinc-800 dark:text-zinc-50">
      <div
        className={`mx-auto space-y-6 ${isDevMode ? "max-w-6xl" : "max-w-6xl"}`}
      >
        <div className="grid grid-cols-3 items-center gap-3">
          <div />
          <div className="text-center col-start-2">
            <h1 className="text-4xl font-bold bg-linear-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              {isDevMode ? "Video & Audio Analysis" : "AI Voice Coach"}
            </h1>
            {!isDevMode && (
              <p className="text-sm text-zinc-500 mt-2">
                Record and analyze your speaking voice with AI-powered insights
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 col-start-3">
            <span
              className={`text-sm ${
                isDevMode ? "font-semibold" : "text-gray-500"
              }`}
            >
              Dev
            </span>
            <div className="relative inline-flex h-6 w-12 items-center rounded-full p-1">
              <button
                type="button"
                aria-checked={isDevMode}
                onClick={() => setIsDevMode((v) => !v)}
                role="switch"
                aria-label={isDevMode ? "Dev mode" : "Prod mode"}
                className={`h-4 w-4 rounded-full bg-white shadow transform transition-transform z-10 ${
                  isDevMode ? "translate-x-0" : "translate-x-6"
                }`}
                title={isDevMode ? "Dev Mode" : "Prod Mode"}
              />
              <div
                className={`absolute inset-0 rounded-full pointer-events-none ${
                  isDevMode ? "bg-green-200" : "bg-indigo-200"
                }`}
              />
            </div>
            <span
              className={`text-sm ${
                !isDevMode ? "font-semibold" : "text-gray-500"
              }`}
            >
              Prod
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div
            className={`rounded-xl shadow-lg bg-white p-6 ${
              !isDevMode ? "border-2 border-indigo-100" : "border"
            }`}
          >
            <div className="mb-6 flex justify-center">
              <fieldset className="inline-flex rounded-lg shadow-md">
                <button
                  type="button"
                  onClick={() => setMode("video")}
                  className={`px-6 py-3 text-base font-semibold border-2 rounded-l-lg transition-all ${
                    mode === "video"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-indigo-300"
                  }`}
                >
                  Video
                </button>
                <button
                  type="button"
                  onClick={() => setMode("audio")}
                  className={`px-6 py-3 text-base font-semibold border-2 rounded-r-lg transition-all ${
                    mode === "audio"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-indigo-300"
                  }`}
                >
                  Audio
                </button>
              </fieldset>
            </div>

            <div className="relative h-80 w-full bg-linear-to-br from-zinc-900 to-black rounded-lg overflow-hidden shadow-inner border-2 border-zinc-800">
              <video
                ref={videoRef}
                className={`h-full w-full ${mode === "audio" ? "hidden" : ""}`}
                style={{
                  transform: recording && !videoBlob ? "scaleX(-1)" : "none",
                }}
                muted={recording || !videoBlob}
              ></video>
              {mode === "audio" && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="mb-4 text-7xl animate-pulse">
                      {recording ? "🔴" : "🎤"}
                    </div>
                    <p className="text-xl font-semibold">
                      {recording ? "Recording Audio..." : "Ready to Record"}
                    </p>
                    {recording && (
                      <div className="mt-4 flex justify-center gap-2">
                        <div
                          className="w-2 h-8 bg-red-500 rounded animate-pulse"
                          style={{ animationDelay: "0ms" }}
                        ></div>
                        <div
                          className="w-2 h-8 bg-red-500 rounded animate-pulse"
                          style={{ animationDelay: "150ms" }}
                        ></div>
                        <div
                          className="w-2 h-8 bg-red-500 rounded animate-pulse"
                          style={{ animationDelay: "300ms" }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {!recording ? (
                <button
                  type="button"
                  className="flex-1 min-w-[140px] rounded-lg bg-linear-to-r from-green-500 to-green-600 px-6 py-3 text-white font-semibold shadow-md hover:shadow-lg hover:from-green-600 hover:to-green-700 transition-all"
                  onClick={startRecording}
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  className="flex-1 min-w-[140px] rounded-lg bg-linear-to-r from-red-500 to-red-600 px-6 py-3 text-white font-semibold shadow-md hover:shadow-lg animate-pulse"
                  onClick={stopRecording}
                >
                  Stop Recording
                </button>
              )}
              <button
                type="button"
                disabled={!videoBlob}
                className="flex-1 min-w-[140px] rounded-lg bg-linear-to-r from-slate-600 to-slate-700 px-6 py-3 text-white font-semibold shadow-md hover:shadow-lg hover:from-slate-700 hover:to-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (videoRef.current && videoBlob) {
                    // Stop any active stream before preview
                    const stream = videoRef.current
                      .srcObject as MediaStream | null;
                    if (stream) {
                      for (const track of stream.getTracks()) {
                        track.stop();
                      }
                      videoRef.current.srcObject = null;
                    }
                    videoRef.current.src = URL.createObjectURL(videoBlob);
                    videoRef.current.controls = true;
                    videoRef.current.muted = false;
                    videoRef.current.play().catch(() => {});
                  }
                }}
              >
                Preview
              </button>
              <button
                type="button"
                disabled={!videoBlob}
                className="flex-1 min-w-[140px] rounded-lg bg-linear-to-r from-blue-500 to-blue-600 px-6 py-3 text-white font-semibold shadow-md hover:shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  setVideoBlob(null);
                  setResult(null);
                }}
              >
                Clear
              </button>
            </div>

            {/* Submit button - always visible */}
            <div className="mt-6">
              {!isDevMode && videoBlob && (
                <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-semibold text-center">
                    Recording ready! Click below to analyze your voice.
                  </p>
                </div>
              )}
              <button
                type="button"
                className="w-full rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white text-xl font-bold shadow-lg hover:shadow-xl hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] disabled:transform-none"
                onClick={submitAnalysis}
                disabled={loading || !videoBlob}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                      <title>Loading</title>
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing Your Voice...
                  </span>
                ) : (
                  "🚀 Analyze My Voice"
                )}
              </button>
              {isDevMode && videoBlob && (
                <p className="mt-2 text-sm text-zinc-600 text-center">
                  Recorded ready ({(videoBlob.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          </div>

          {isDevMode && (
            <div className="rounded-xl border shadow-lg bg-white p-6">
              <label htmlFor="prompt" className="block text-sm font-medium">
                Prompt
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
                  onClick={() => setPrompt(VISUAL_COACHING_PROMPT)}
                >
                  Use Visual Coaching Prompt
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-100"
                  onClick={() => setPrompt(DEFAULT_PROMPT)}
                >
                  Use Summary Prompt
                </button>
              </div>
              <textarea
                id="prompt"
                className="mt-1 h-28 w-full rounded border p-2"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="mt-4">
                <label htmlFor="provider" className="block text-sm font-medium">
                  Provider
                </label>
                <select
                  id="provider"
                  value={selectedProvider}
                  onChange={(e) =>
                    setSelectedProvider(e.target.value as "openai" | "gemini")
                  }
                  className="mt-1 w-full rounded border p-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini (Google)</option>
                </select>
              </div>
              <div className="mt-4">
                <label htmlFor="model" className="block text-sm font-medium">
                  Model
                </label>
                <select
                  id="model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-1 w-full rounded border p-2"
                >
                  {models
                    .filter((m) => m.provider === selectedProvider)
                    .map((m) => (
                      <option key={`${m.provider}-${m.id}`} value={m.id}>
                        {m.displayName || m.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl shadow-lg bg-white p-6 border-2 border-zinc-200">
          <h2 className="text-2xl font-bold text-zinc-800 mb-2">
            📊 Analysis Results
          </h2>
          <div className="mt-3 space-y-3">
            {result ? (
              result.error ? (
                <p className="text-sm text-red-500">{result.error}</p>
              ) : result.coachingReport ? (
                <VisualCoachingReport report={result.coachingReport} />
              ) : result.analysis ? (
                <div>
                  <h3 className="font-medium">Analysis</h3>
                  <pre className="whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm">
                    {result.analysis}
                  </pre>
                </div>
              ) : null
            ) : (
              <p className="text-sm text-zinc-500">
                No result yet. Record a video and click submit to analyze.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
