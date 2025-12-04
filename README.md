## Video Analysis App

This app records a video in the browser and analyzes it using Google Gemini's multimodal capabilities or OpenAI's audio capabilities.

- **Gemini**: The video is uploaded to Gemini's file API and analyzed with your custom prompt (supports video + audio).
- **OpenAI**: Audio is extracted from the video using ffmpeg and sent to OpenAI's audio-preview model.

### Required environment variables

Create a `.env.local` file in the project root and add:

```bash
OPENAI_API_KEY=sk-...   # Required for OpenAI audio analysis
GEMINI_API_KEY=...       # Required for Gemini video analysis
```

### Run the development server

```bash
# Install dependencies
bun install

# Start the dev server
bun dev
```

### Notes

- **Gemini** supports native multimodal video input (video + audio analysis).
- **OpenAI** extracts audio from the video and uses the `gpt-4o-audio-preview` model.
- The API uses server-side keys. Do not expose your API keys in the browser.
- Gemini and OpenAI models are listed from each provider's API automatically.

### Deploying to Vercel (ffmpeg note)

When deploying to Vercel (or other serverless platforms) the system `ffmpeg` binary is often not available. To ensure audio extraction works in the serverless runtime, add a bundled ffmpeg binary to your project using `ffmpeg-static` and redeploy.

```bash
# Install bundled ffmpeg binary
bun add ffmpeg-static

# Or with npm
npm install ffmpeg-static

# Then redeploy to Vercel
git add package.json bun.lockb package.json.lock && git commit -m "Add ffmpeg-static" && git push
vercel --prod
```

The code already configures `fluent-ffmpeg` to use the static binary at runtime. If you prefer not to include a binary, alternatives:

- Install `ffmpeg` on the host (not possible on many serverless hosts).
- Use a WebAssembly-based approach (`@ffmpeg/ffmpeg`) to decode audio in Node.js or the edge.
