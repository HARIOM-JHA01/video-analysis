import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createPartFromUri,
  createUserContent,
  GoogleGenAI,
} from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { VisualCoachingReport } from "@/types/analysis";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function saveFormFile(file: Blob, dest: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
  return dest;
}

// Use system ffmpeg (installed via apt-get in Docker)
ffmpeg.setFfmpegPath("/usr/bin/ffmpeg");

// Extract audio from video using fluent-ffmpeg
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(audioPath);
  });
}

export async function POST(request: Request) {
  try {
    const fd = await request.formData();
    const file = fd.get("file") as Blob | null;
    const provider = (fd.get("provider") as string) || "gemini";
    const model = (fd.get("model") as string) || "";
    const prompt = (fd.get("prompt") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "va-"));
    const videoPath = path.join(tmpDir, "recording.webm");
    await saveFormFile(file, videoPath);

    let analysis = "";

    if (provider === "openai") {
      // Extract audio from video and send to OpenAI audio model
      const audioPath = path.join(tmpDir, "audio.wav");
      // eslint-disable-next-line no-console
      console.log("Extracting audio from video...");
      await extractAudio(videoPath, audioPath);

      // Read audio as base64
      const audioBuffer = await fs.promises.readFile(audioPath);
      const base64Audio = audioBuffer.toString("base64");
      // eslint-disable-next-line no-console
      console.log("Audio extracted, sending to OpenAI...");

      const res = await openai.chat.completions.create({
        model: "gpt-4o-audio-preview",
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "wav" },
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that analyzes audio/video content.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "input_audio",
                input_audio: { data: base64Audio, format: "wav" },
              },
            ],
          },
        ],
      });
      analysis =
        res.choices?.[0]?.message?.content ??
        res.choices?.[0]?.message?.audio?.transcript ??
        JSON.stringify(res);
    } else {
      // Gemini: Upload the file and use it with generateContent for true video analysis
      // eslint-disable-next-line no-console
      console.log("Uploading video to Gemini...");
      let uploadedFile = await gemini.files.upload({
        file: videoPath,
        config: { mimeType: "video/webm" },
      });
      // eslint-disable-next-line no-console
      console.log("Video uploaded:", uploadedFile);

      // Wait for the file to become ACTIVE (it starts in PROCESSING state)
      const maxWaitMs = 120_000; // 2 minutes max
      const pollIntervalMs = 2_000; // check every 2 seconds
      const startTime = Date.now();
      while (uploadedFile.state === "PROCESSING") {
        if (Date.now() - startTime > maxWaitMs) {
          throw new Error(
            "Timeout waiting for video file to finish processing"
          );
        }
        // eslint-disable-next-line no-console
        console.log("File still processing, waiting...");
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        // Re-fetch file status
        if (uploadedFile.name) {
          uploadedFile = await gemini.files.get({ name: uploadedFile.name });
        }
      }

      if (uploadedFile.state !== "ACTIVE") {
        throw new Error(
          `File processing failed with state: ${uploadedFile.state}`
        );
      }
      // eslint-disable-next-line no-console
      console.log("File is now ACTIVE, generating content...");

      // Use createPartFromUri and createUserContent to build multimodal request
      const videoPart = createPartFromUri(
        uploadedFile.uri ?? "",
        uploadedFile.mimeType ?? "video/webm"
      );
      const resp = await gemini.models.generateContent({
        model: model || "gemini-2.5-flash",
        contents: createUserContent([videoPart, prompt]),
      });

      // Extract text from response
      const respUnknown = resp as unknown as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const parts = (respUnknown.candidates?.[0]?.content?.parts ?? []) as {
        text?: string;
      }[];
      analysis =
        parts.map((p) => p.text ?? "").join("\n") ||
        JSON.stringify(respUnknown);

      // Delete the uploaded file from Gemini storage after processing
      //   try {
      //     if (uploadedFile.name) {
      //       await gemini.files.delete({ name: uploadedFile.name });
      //       // eslint-disable-next-line no-console
      //       console.log("Deleted uploaded file from Gemini:", uploadedFile.name);
      //     }
      //   } catch (deleteErr) {
      //     // eslint-disable-next-line no-console
      //     console.error("Failed to delete uploaded file:", deleteErr);
      //   }
    }

    // Cleanup local file and tmp dir
    try {
      await fs.promises.unlink(videoPath);
    } catch {}
    try {
      await fs.promises.rmdir(tmpDir);
    } catch {}

    // Map the freeform analysis to structured coaching report
    const coachingReport = await generateCoachingReport(analysis, provider);

    return NextResponse.json({
      coachingReport,
      analysis, // keep for backward compatibility
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function generateCoachingReport(
  rawAnalysis: string,
  provider: string
): Promise<VisualCoachingReport> {
  try {
    // Use the provider's API to map the freeform analysis into structured JSON
    const mappingPrompt = `You are a coaching report generator. Given the following video/audio analysis, generate a structured coaching report in JSON format.

Analysis:
${rawAnalysis}

Generate a JSON object with these exact fields:
- toneWarmth: number (0-10, representing warmth of speaker's tone)
- score: number (0-100, overall coaching score)
- badge: string (one of: "🚫 Needs Support", "🌼 Growing", "🌸 Friendly", "🌺 Caring Expert")
- trainingMeaning: string (one clear sentence describing what to improve)
- voiceRecipe: array of 3 objects, each with "ingredient" (string) and "tip" (string) - specific actionable advice
- audioStyles: object with "tryIt" (array of 2-3 short style recommendations) and "dontTry" (array of 2-3 styles to avoid)
- practiceExercise: string (a 15-second practice drill, 2-3 sentences)
- empathyGoal: string (one sentence, brand-themed goal like "Sound like you are delivering flowers with your voice")

Return ONLY valid JSON, no markdown, no explanation.`;

    let mappedJson = "";

    if (provider === "openai") {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a JSON generator. Return only valid JSON.",
          },
          { role: "user", content: mappingPrompt },
        ],
        response_format: { type: "json_object" },
      });
      mappedJson = res.choices?.[0]?.message?.content ?? "{}";
    } else {
      // Use Gemini for mapping
      const resp = await gemini.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: mappingPrompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });
      const respUnknown = resp as unknown as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const parts = (respUnknown.candidates?.[0]?.content?.parts ?? []) as {
        text?: string;
      }[];
      mappedJson = parts.map((p) => p.text ?? "").join("\n") || "{}";
    }

    const parsed = JSON.parse(mappedJson) as VisualCoachingReport;

    // Add rawAnalysis for reference
    parsed.rawAnalysis = rawAnalysis;

    // Validate and provide defaults
    return {
      toneWarmth: parsed.toneWarmth ?? 5,
      score: parsed.score ?? 50,
      badge: parsed.badge ?? "🌼 Growing",
      trainingMeaning:
        parsed.trainingMeaning ?? "Continue developing your coaching voice",
      voiceRecipe: parsed.voiceRecipe ?? [
        { ingredient: "Pitch", tip: "Maintain steady pitch" },
        { ingredient: "Pauses", tip: "Add natural pauses" },
        { ingredient: "Tone", tip: "Speak warmly" },
      ],
      audioStyles: parsed.audioStyles ?? {
        tryIt: ["Warm conversational"],
        dontTry: ["Monotone"],
      },
      practiceExercise:
        parsed.practiceExercise ??
        "Practice speaking with a smile. Repeat your greeting 3 times.",
      empathyGoal:
        parsed.empathyGoal ??
        "Sound caring and supportive in every interaction.",
      rawAnalysis: parsed.rawAnalysis,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to generate coaching report:", error);
    // Return a default report if mapping fails
    return {
      toneWarmth: 5,
      score: 50,
      badge: "🌼 Growing",
      trainingMeaning: "Analysis completed. Review the full analysis below.",
      voiceRecipe: [
        { ingredient: "Clarity", tip: "Speak clearly and at a moderate pace" },
        { ingredient: "Warmth", tip: "Add warmth to your tone" },
        { ingredient: "Engagement", tip: "Engage with energy and enthusiasm" },
      ],
      audioStyles: {
        tryIt: ["Conversational and friendly", "Clear enunciation"],
        dontTry: ["Monotone delivery", "Speaking too fast"],
      },
      practiceExercise:
        "Take a breath, smile, and practice your greeting with warmth. Repeat 3 times.",
      empathyGoal: "Make every interaction feel personal and caring.",
      rawAnalysis,
    };
  }
}
