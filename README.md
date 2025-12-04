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
