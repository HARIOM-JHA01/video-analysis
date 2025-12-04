"use client";
import { useEffect, useRef, useState } from "react";

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
    "gemini",
  );
  const [prompt, setPrompt] = useState<string>(
    "Please analyze this video and provide: summary, main topics, sentiment, and key takeaways with timestamps if available.",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    analysis?: string;
    error?: string;
  } | null>(null);

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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    if (videoRef.current) {
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
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-black text-zinc-800 dark:text-zinc-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl text-center font-bold">Video Analysis</h1>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded border bg-white p-4">
            <video
              ref={videoRef}
              className="h-64 w-full bg-black"
              muted
            ></video>
            <div className="mt-4 flex gap-2">
              {!recording ? (
                <button
                  type="button"
                  className="rounded bg-green-500 px-4 py-2 text-white"
                  onClick={startRecording}
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded bg-red-500 px-4 py-2 text-white"
                  onClick={stopRecording}
                >
                  Stop Recording
                </button>
              )}
              <button
                type="button"
                className="rounded bg-slate-700 px-4 py-2 text-white"
                onClick={() => {
                  if (videoRef.current && videoBlob) {
                    videoRef.current.src = URL.createObjectURL(videoBlob);
                    videoRef.current.controls = true;
                    videoRef.current.play().catch(() => {});
                  }
                }}
              >
                Preview
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-white"
                onClick={() => {
                  setVideoBlob(null);
                  setResult(null);
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="rounded border bg-white p-4">
            <label htmlFor="prompt" className="block text-sm font-medium">
              Prompt
            </label>
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
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="mt-2 w-full rounded bg-indigo-600 px-4 py-2 text-white"
                onClick={submitAnalysis}
                disabled={loading || !videoBlob}
              >
                {loading ? "Analyzing..." : "Submit Analysis"}
              </button>
            </div>
            {videoBlob && (
              <p className="mt-2 text-sm text-zinc-600">
                Recorded video ready ({(videoBlob.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        <div className="rounded border bg-white p-4">
          <h2 className="text-xl font-semibold">Results</h2>
          <div className="mt-3 space-y-3">
            {result ? (
              result.error ? (
                <p className="text-sm text-red-500">{result.error}</p>
              ) : (
                <div>
                  <h3 className="font-medium">Analysis</h3>
                  <pre className="whitespace-pre-wrap rounded bg-zinc-50 p-3 text-sm">
                    {result.analysis}
                  </pre>
                </div>
              )
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
