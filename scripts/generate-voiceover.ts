import { openai } from "../server/integrations/audio/client";
import { writeFile } from "fs/promises";
import { execSync } from "child_process";
import { Buffer } from "node:buffer";

const segments = [
  "Introducing NextApe Terminal. The most powerful crypto trading platform ever built.",

  "Trade across five major blockchains. Solana, Ethereum, Base, BNB Chain, and Tron. All from one unified terminal.",

  "Professional candlestick charts powered by TradingView. Six timeframes. Real-time WebSocket streaming. Moving averages, RSI, MACD, Bollinger Bands. Every tool a serious trader needs.",

  "Protect your capital with our GoPlus security scanner. Real on-chain audits. Honeypot detection. Tax analysis. Contract verification. LP lock status. Eight-factor safety scoring with AI recommendations.",

  "Deploy AI trading agents that trade while you sleep. Four risk profiles from conservative to degen. Powered by OpenAI. Fully autonomous with real-time activity logs and performance tracking.",

  "Discover meme tokens the moment they launch. Live DexScreener data. Over one hundred tokens tracked across twelve launchpads. Bonding curves. Dev wallet analysis. Auto-refresh every thirty seconds.",

  "Execute real swaps on-chain. Built-in encrypted wallets. Jupiter for Solana. Uniswap for Ethereum and Base. PancakeSwap for BNB Chain. Quick-buy buttons for instant entries.",

  "Copy smart money wallets. Track whale performance and mirror their trades automatically. Sniper mode targets tokens with custom rules. Twenty-four seven monitoring. Instant execution.",

  "Automate with limit orders, stop-loss, and dollar-cost averaging. Price alerts when tokens hit your targets. Portfolio dashboard with real-time P and L across all chains.",

  "NextApe Terminal. Five blockchains. Real on-chain execution. AI agents. Institutional charts. Comprehensive security. Built different. Trade smarter.",
];

const SYSTEM_PROMPT = `You are a text-to-speech engine. Your ONLY job is to speak the exact words given to you. 

RULES:
- Say EXACTLY what the user writes. Do not add ANY words.
- Do not say "sure", "okay", "here you go", or any introduction.
- Do not add commentary, greetings, or sign-offs.
- Just read the text out loud, nothing else.
- Speak in a deep, confident, professional narrator voice.
- Pace yourself at a moderate speed suitable for a product advertisement.`;

async function generateSegment(text: string, index: number): Promise<Buffer> {
  console.log(`  Segment ${index + 1}/${segments.length}: "${text.substring(0, 70)}..."`);
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice: "onyx", format: "wav" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Read this EXACTLY: "${text}"` },
    ],
  });

  const msg = response.choices[0]?.message as any;
  const transcript = msg?.audio?.transcript || "";
  console.log(`    Transcript: "${transcript.substring(0, 80)}..."`);

  const audioData = msg?.audio?.data ?? "";
  if (!audioData) throw new Error(`No audio for segment ${index + 1}`);
  return Buffer.from(audioData, "base64");
}

async function main() {
  console.log(`Generating ${segments.length} voiceover segments for ~2 min ad...\n`);

  const segmentPaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    let audio: Buffer | null = null;
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        audio = await generateSegment(segments[i], i);
        if (audio && audio.length > 1000) break;
      } catch (e: any) {
        console.log(`    Error: ${e.message}, retrying...`);
      }
    }
    if (!audio || audio.length < 1000) throw new Error(`Failed segment ${i + 1}`);

    const path = `/tmp/vo_2min_${i}.wav`;
    await writeFile(path, audio);
    segmentPaths.push(path);
    console.log(`    OK (${(audio.length / 1024).toFixed(0)}KB)\n`);
  }

  console.log("Concatenating all segments...");
  const listContent = segmentPaths.map((p) => `file '${p}'`).join("\n");
  await writeFile("/tmp/vo_2min_list.txt", listContent);

  execSync(
    `ffmpeg -y -f concat -safe 0 -i /tmp/vo_2min_list.txt -c:a pcm_s16le -ar 24000 -ac 1 /tmp/voiceover_2min.wav 2>/dev/null`,
    { stdio: "inherit" }
  );

  const durationOut = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 /tmp/voiceover_2min.wav`
  ).toString().trim();
  const duration = Math.round(parseFloat(durationOut));
  console.log(`\nVoiceover duration: ${duration} seconds (${Math.floor(duration/60)}m ${duration%60}s)`);
  console.log("Saved to /tmp/voiceover_2min.wav");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
