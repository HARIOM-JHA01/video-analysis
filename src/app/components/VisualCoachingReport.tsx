"use client";
import type { VisualCoachingReport as ReportType } from "@/types/analysis";

interface Props {
  report: ReportType;
}

export default function VisualCoachingReport({ report }: Props) {
  const getBadgeColor = (badge: string) => {
    if (badge.includes("🚫")) return "bg-red-100 text-red-800 border-red-300";
    if (badge.includes("🌼"))
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (badge.includes("🌸"))
      return "bg-pink-100 text-pink-800 border-pink-300";
    if (badge.includes("🌺"))
      return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  const getMeterColor = (warmth: number) => {
    if (warmth < 4) return "bg-blue-400"; // Cold
    if (warmth < 7) return "bg-yellow-400"; // Neutral
    if (warmth < 9) return "bg-pink-400"; // Warm
    return "bg-purple-400"; // Very Warm
  };

  const getMeterLabel = (warmth: number) => {
    if (warmth < 4) return "❄️ Cold";
    if (warmth < 7) return "😊 Neutral";
    if (warmth < 9) return "🌸 Warm";
    return "🌺 Very Warm";
  };

  return (
    <div className="space-y-6">
      {/* Tone Warmth Meter */}
      <div className="rounded-lg border bg-linear-to-br from-blue-50 to-pink-50 p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          🎚️ Tone Warmth Meter
        </h3>
        <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
          <span>❄️ Cold</span>
          <span>😊 Neutral</span>
          <span>🌸 Warm</span>
          <span>🌺 Very Warm</span>
        </div>
        <div className="relative h-8 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full ${getMeterColor(
              report.toneWarmth
            )} transition-all duration-500`}
            style={{ width: `${(report.toneWarmth / 10) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-center text-lg font-medium text-gray-700">
          {getMeterLabel(report.toneWarmth)} ({report.toneWarmth}/10)
        </p>
      </div>

      {/* Score Badge */}
      <div className="rounded-lg border bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          📊 Coaching Score
        </h3>
        <div className="flex items-center gap-4">
          <div
            className={`inline-flex items-center rounded-full border-2 px-6 py-3 text-2xl font-bold ${getBadgeColor(
              report.badge
            )}`}
          >
            {report.badge}
          </div>
          <div className="flex-1">
            <div className="text-3xl font-bold text-gray-800">
              {report.score}/100
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {report.trainingMeaning}
            </p>
          </div>
        </div>
      </div>

      {/* Voice Recipe */}
      <div className="rounded-lg border bg-linear-to-br from-orange-50 to-yellow-50 p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          🧁 Empathy Voice Recipe
        </h3>
        <div className="space-y-3">
          {report.voiceRecipe.map((item, idx) => (
            <div
              key={`recipe-${item.ingredient}`}
              className="flex items-start gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-400 text-lg font-bold text-white">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">
                  {item.ingredient}
                </div>
                <div className="text-sm text-gray-600">{item.tip}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Styles */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-green-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-green-800">
            <span className="text-xl">✅</span> Try It Like This
          </h4>
          <ul className="space-y-1">
            {report.audioStyles.tryIt.map((style) => (
              <li key={`tryit-${style}`} className="text-sm text-gray-700">
                🎧 {style}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-red-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-semibold text-red-800">
            <span className="text-xl">❌</span> Don&apos;t Say It Like This
          </h4>
          <ul className="space-y-1">
            {report.audioStyles.dontTry.map((style) => (
              <li key={`donttry-${style}`} className="text-sm text-gray-700">
                🔊 {style}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Practice Exercise */}
      <div className="rounded-lg border bg-linear-to-br from-purple-50 to-blue-50 p-5">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          📌 15-Second Warm Tone Exercise
        </h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {report.practiceExercise}
        </p>
      </div>

      {/* Empathy Goal */}
      <div className="rounded-lg border bg-linear-to-r from-pink-100 to-rose-100 p-5">
        <h3 className="mb-2 text-lg font-semibold text-gray-800">
          🌹 Empathy Goal
        </h3>
        <p className="text-base italic text-gray-700">{report.empathyGoal}</p>
      </div>

      {/* Raw Analysis (collapsible) */}
      {report.rawAnalysis && (
        <details className="rounded-lg border bg-gray-50 p-4">
          <summary className="cursor-pointer font-semibold text-gray-700">
            📝 Full Analysis (click to expand)
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-600">
            {report.rawAnalysis}
          </pre>
        </details>
      )}
    </div>
  );
}
