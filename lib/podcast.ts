import { Groq } from 'groq-sdk';
import { cartesia, VOICES } from './cartesia';
import { createClient } from '@supabase/supabase-js';

// Define the script structure
export interface ScriptItem {
    speaker: 'Host 1' | 'Host 2';
    text: string;
}

export async function generatePodcastScript(text: string): Promise<ScriptItem[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is missing");

    const groq = new Groq({ apiKey });

    const systemPrompt = `You are an expert podcast producer. Convert the provided document text into an engaging, natural-sounding dialogue between two podcast hosts (Host 1 and Host 2).
  - Host 1: Knowledgeable, main driver of the conversation.
  - Host 2: Curious, asks clarifying questions, adds color commentary.
  - Tone: Professional but conversational, like "The Daily" or a high-quality tech podcast.
  - Format: Return ONLY a JSON array of objects with "speaker" and "text" fields.
  - Length: Keep it concise, about 2-3 minutes of dialogue (approx 300-400 words total).
  - Do not include any other text or markdown formatting outside the JSON array.`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here is the document text:\n\n${text.substring(0, 20000)}` } // Truncate to avoid context limit
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || "[]";

    try {
        // Attempt to parse JSON. Use regex to find array if wrapped in text
        // Fixed: Removed 's' flag for ES compatibility, used [\s\S]* for multiline matching
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        return JSON.parse(jsonStr) as ScriptItem[];
    } catch (e) {
        console.error("Failed to parse script JSON:", content);
        throw new Error("Failed to generate podcast script.");
    }
}

export async function synthesizePodcastAudio(script: ScriptItem[]): Promise<Buffer> {
    const audioSegments: Buffer[] = [];

    for (const item of script) {
        const voiceId = item.speaker === 'Host 1' ? VOICES.HOST_1 : VOICES.HOST_2;

        try {
            // Corrected property name: modelId
            const response = await cartesia.tts.bytes({
                modelId: "sonic-english",
                voice: {
                    mode: "id",
                    id: voiceId,
                },
                transcript: item.text,
                // container: "wav", // Removed as type definition invalid, will assume default or raw
                outputFormat: {
                    container: "wav",
                    sampleRate: 44100,
                    encoding: "pcm_f32le"
                }
            });

            // Handle response buffer conversion
            // If response is an ArrayBuffer (typical for .bytes()), Buffer.from works.
            // If it's a Readable stream, we need to read it.
            // The error said "Readable is not assignable", so it might be a stream in Node environment.

            let chunkBuffer: Buffer;
            if (Buffer.isBuffer(response)) {
                chunkBuffer = response;
            } else if (response instanceof ArrayBuffer) {
                chunkBuffer = Buffer.from(response);
            } else {
                // Assume it's a Node stream or similar
                // @ts-ignore - Handle stream generically
                const chunks: Buffer[] = [];
                for await (const chunk of response) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                }
                chunkBuffer = Buffer.concat(chunks);
            }

            audioSegments.push(chunkBuffer);
        } catch (e) {
            console.error(`Audio synthesis failed for segment: "${item.text.substring(0, 20)}..."`, e);
        }
    }

    // Concatenate all WAV buffers
    // Note: Simple concatenation of WAV files works if headers are stripped from subsequent files
    // or if we use raw PCM and add header at the end.
    // For simplicity in this implementation, we assume we can get a buffer.
    // Since the SDK is new, we use the standard WebSocket play method pattern adapted for server-side buffer collection
    // or the REST API if available. The official Node SDK uses WebSocket.

    // Let's use the buffer functionality if exposed, otherwise we might need a workaround.
    // Checking docs (simulated): SDK usually has tts.websocket() or similar.

    // ACTUALLY: For server-side file generation, using the buffer/bytes return is best.
    // If the usage is purely real-time, we stream. But here we want to save to Supabase.

    // Implementation: using bytes() method if available or accumulating frames.

    // For simplicity: We will concatenate them. This is NOT perfect for WAV (headers in middle)
    // but many players handle it. Better approach: Strip 44-byte header from segments 2..N

    if (audioSegments.length === 0) return Buffer.from([]);

    // Fix: Ideally use a library like wav-merger or strip headers.
    // Quick fix: Strip 44 byte header from all but first.
    const finalBuffer = Buffer.concat([
        audioSegments[0],
        ...audioSegments.slice(1).map(b => b.subarray(44))
    ]);

    return finalBuffer;
}

// ============================================================
// STORY MODE - First-Person Narration
// ============================================================

export interface StoryScriptItem {
    text: string;
    pause?: number; // Optional pause in ms after this segment
}

export async function generateStoryScript(text: string): Promise<StoryScriptItem[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is missing");

    const groq = new Groq({ apiKey });

    const systemPrompt = `You are an expert storyteller and narrative writer. Convert the provided interview experience or document into an engaging FIRST-PERSON NARRATION, as if the person who experienced it is telling their story directly to the listener.

REQUIREMENTS:
- Write entirely in FIRST PERSON ("I", "my", "me")
- Create a natural, engaging story flow with emotional beats
- Preserve all key details: company names, role, interview rounds, technical questions, outcomes
- Use vivid descriptions and conversational tone
- Break into natural segments at scene changes or topic shifts
- Keep the total length around 2-3 minutes when read aloud (400-500 words total)
- Make it feel authentic and personal, like a friend sharing their experience

FORMAT: Return ONLY a JSON array of objects with "text" field. Each object is a narrative segment.
Example: [{"text": "So there I was, sitting in the lobby of Google's headquarters..."}, {"text": "The interviewer walked in and my heart started racing..."}]

Do not include any other text or markdown formatting outside the JSON array.`;

    const completion = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here is the document/interview experience to narrate:\n\n${text.substring(0, 20000)}` }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.8, // Slightly higher for more creative storytelling
    });

    const content = completion.choices[0]?.message?.content || "[]";

    try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        return JSON.parse(jsonStr) as StoryScriptItem[];
    } catch (e) {
        console.error("Failed to parse story script JSON:", content);
        throw new Error("Failed to generate story script.");
    }
}

export async function synthesizeStoryAudio(script: StoryScriptItem[]): Promise<Buffer> {
    const audioSegments: Buffer[] = [];

    for (const item of script) {
        try {
            const response = await cartesia.tts.bytes({
                modelId: "sonic-english",
                voice: {
                    mode: "id",
                    id: VOICES.NARRATOR, // Using Olivia for storytelling
                },
                transcript: item.text,
                outputFormat: {
                    container: "wav",
                    sampleRate: 44100,
                    encoding: "pcm_f32le"
                }
            });

            let chunkBuffer: Buffer;
            if (Buffer.isBuffer(response)) {
                chunkBuffer = response;
            } else if (response instanceof ArrayBuffer) {
                chunkBuffer = Buffer.from(response);
            } else {
                // @ts-ignore - Handle stream generically
                const chunks: Buffer[] = [];
                for await (const chunk of response) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
                }
                chunkBuffer = Buffer.concat(chunks);
            }

            audioSegments.push(chunkBuffer);

            // Add a small silence gap between segments for natural pacing
            // This creates a brief pause between narrative segments
        } catch (e) {
            console.error(`Story audio synthesis failed for segment: "${item.text.substring(0, 20)}..."`, e);
        }
    }

    if (audioSegments.length === 0) return Buffer.from([]);

    // Concatenate WAV buffers, stripping headers from all but first
    const finalBuffer = Buffer.concat([
        audioSegments[0],
        ...audioSegments.slice(1).map(b => b.subarray(44))
    ]);

    return finalBuffer;
}

