import { CartesiaClient } from '@cartesia/cartesia-js';

const apiKey = process.env.CARTESIA_API_KEY;

if (!apiKey) {
    console.warn("CARTESIA_API_KEY is not set. Podcast generation will fail.");
}

export const cartesia = new CartesiaClient({
    apiKey: apiKey || 'dummy-key', // Prevent crash on init, correct usage requires valid key
});

export const VOICES = {
    HOST_1: "1110be38-d524-457d-a7be-87be446a4b0d", // Voice: David
    HOST_2: "17ab4eb9-ef77-4a31-85c5-0603e9fce546", // Voice: Matt
    NARRATOR: "00a77add-48d5-4ef6-8157-71e5437b282d", // Voice: Olivia - Playful, expressive storytelling
};

