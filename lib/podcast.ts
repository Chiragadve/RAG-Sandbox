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

    console.log(`[Podcast] Starting synthesis for ${script.length} segments`);

    for (let i = 0; i < script.length; i++) {
        const item = script[i];
        const voiceId = item.speaker === 'Host 1' ? VOICES.HOST_1 : VOICES.HOST_2;

        try {
            console.log(`[Podcast] Synthesizing segment ${i + 1}/${script.length}: "${item.text.substring(0, 30)}..."`);

            const response = await cartesia.tts.bytes({
                modelId: "sonic-english",
                voice: {
                    mode: "id",
                    id: voiceId,
                },
                transcript: item.text,
                outputFormat: {
                    container: "wav",
                    sampleRate: 44100,
                    encoding: "pcm_f32le"
                }
            });

            // Handle all possible response types from Cartesia SDK
            // In serverless/production, it often returns Uint8Array instead of Buffer
            let chunkBuffer: Buffer;

            if (Buffer.isBuffer(response)) {
                console.log(`[Podcast] Segment ${i + 1}: Got Buffer (${response.length} bytes)`);
                chunkBuffer = response;
            } else if (response instanceof Uint8Array) {
                // CRITICAL: Serverless environments return Uint8Array, not Buffer
                console.log(`[Podcast] Segment ${i + 1}: Got Uint8Array (${response.length} bytes)`);
                chunkBuffer = Buffer.from(response);
            } else if (response instanceof ArrayBuffer) {
                console.log(`[Podcast] Segment ${i + 1}: Got ArrayBuffer (${response.byteLength} bytes)`);
                chunkBuffer = Buffer.from(response);
            } else if (typeof response === 'object' && response !== null && Symbol.asyncIterator in response) {
                // Handle async iterable (stream)
                console.log(`[Podcast] Segment ${i + 1}: Got async stream, collecting...`);
                const chunks: Buffer[] = [];
                for await (const chunk of response as AsyncIterable<Uint8Array>) {
                    if (chunk instanceof Uint8Array) {
                        chunks.push(Buffer.from(chunk));
                    } else if (Buffer.isBuffer(chunk)) {
                        chunks.push(chunk);
                    } else if (typeof chunk === 'string') {
                        chunks.push(Buffer.from(chunk));
                    }
                }
                chunkBuffer = Buffer.concat(chunks);
                console.log(`[Podcast] Segment ${i + 1}: Stream collected (${chunkBuffer.length} bytes)`);
            } else {
                // Last resort: try to convert whatever we got
                console.warn(`[Podcast] Segment ${i + 1}: Unknown response type: ${typeof response}, attempting conversion`);
                try {
                    // @ts-ignore - Attempt generic conversion
                    chunkBuffer = Buffer.from(response);
                } catch (convError) {
                    console.error(`[Podcast] Segment ${i + 1}: Failed to convert response`, convError);
                    continue; // Skip this segment
                }
            }

            // Validate we got actual audio data
            if (chunkBuffer.length < 44) {
                console.warn(`[Podcast] Segment ${i + 1}: Buffer too small (${chunkBuffer.length} bytes), skipping`);
                continue;
            }

            audioSegments.push(chunkBuffer);
            console.log(`[Podcast] Segment ${i + 1}: Successfully added (${chunkBuffer.length} bytes)`);

        } catch (e) {
            console.error(`[Podcast] Segment ${i + 1} synthesis failed:`, e);
            // Don't rethrow - continue with other segments
        }
    }

    // Concatenate all WAV buffers
    // Strip 44-byte WAV header from all segments except the first

    if (audioSegments.length === 0) {
        console.error('[Podcast] No audio segments were successfully synthesized!');
        return Buffer.from([]);
    }

    console.log(`[Podcast] Concatenating ${audioSegments.length} segments...`);

    // Validate first segment has proper WAV header
    if (audioSegments[0].length < 44) {
        console.error(`[Podcast] First segment too small for WAV header: ${audioSegments[0].length} bytes`);
        return Buffer.from([]);
    }

    const finalBuffer = Buffer.concat([
        audioSegments[0],
        ...audioSegments.slice(1).map(b => b.subarray(44))
    ]);

    console.log(`[Podcast] Final audio size: ${finalBuffer.length} bytes`);

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

    console.log(`[Story] Starting synthesis for ${script.length} segments`);

    for (let i = 0; i < script.length; i++) {
        const item = script[i];

        try {
            console.log(`[Story] Synthesizing segment ${i + 1}/${script.length}: "${item.text.substring(0, 30)}..."`);

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

            // Handle all possible response types from Cartesia SDK
            // In serverless/production, it often returns Uint8Array instead of Buffer
            let chunkBuffer: Buffer;

            if (Buffer.isBuffer(response)) {
                console.log(`[Story] Segment ${i + 1}: Got Buffer (${response.length} bytes)`);
                chunkBuffer = response;
            } else if (response instanceof Uint8Array) {
                // CRITICAL: Serverless environments return Uint8Array, not Buffer
                console.log(`[Story] Segment ${i + 1}: Got Uint8Array (${response.length} bytes)`);
                chunkBuffer = Buffer.from(response);
            } else if (response instanceof ArrayBuffer) {
                console.log(`[Story] Segment ${i + 1}: Got ArrayBuffer (${response.byteLength} bytes)`);
                chunkBuffer = Buffer.from(response);
            } else if (typeof response === 'object' && response !== null && Symbol.asyncIterator in response) {
                // Handle async iterable (stream)
                console.log(`[Story] Segment ${i + 1}: Got async stream, collecting...`);
                const chunks: Buffer[] = [];
                for await (const chunk of response as AsyncIterable<Uint8Array>) {
                    if (chunk instanceof Uint8Array) {
                        chunks.push(Buffer.from(chunk));
                    } else if (Buffer.isBuffer(chunk)) {
                        chunks.push(chunk);
                    } else if (typeof chunk === 'string') {
                        chunks.push(Buffer.from(chunk));
                    }
                }
                chunkBuffer = Buffer.concat(chunks);
                console.log(`[Story] Segment ${i + 1}: Stream collected (${chunkBuffer.length} bytes)`);
            } else {
                // Last resort: try to convert whatever we got
                console.warn(`[Story] Segment ${i + 1}: Unknown response type: ${typeof response}, attempting conversion`);
                try {
                    // @ts-ignore - Attempt generic conversion
                    chunkBuffer = Buffer.from(response);
                } catch (convError) {
                    console.error(`[Story] Segment ${i + 1}: Failed to convert response`, convError);
                    continue; // Skip this segment
                }
            }

            // Validate we got actual audio data
            if (chunkBuffer.length < 44) {
                console.warn(`[Story] Segment ${i + 1}: Buffer too small (${chunkBuffer.length} bytes), skipping`);
                continue;
            }

            audioSegments.push(chunkBuffer);
            console.log(`[Story] Segment ${i + 1}: Successfully added (${chunkBuffer.length} bytes)`);

        } catch (e) {
            console.error(`[Story] Segment ${i + 1} synthesis failed:`, e);
            // Don't rethrow - continue with other segments
        }
    }

    if (audioSegments.length === 0) {
        console.error('[Story] No audio segments were successfully synthesized!');
        return Buffer.from([]);
    }

    console.log(`[Story] Concatenating ${audioSegments.length} segments...`);

    // Concatenate WAV buffers, stripping headers from all but first
    const finalBuffer = Buffer.concat([
        audioSegments[0],
        ...audioSegments.slice(1).map(b => b.subarray(44))
    ]);

    console.log(`[Story] Final audio size: ${finalBuffer.length} bytes`);

    return finalBuffer;
}

