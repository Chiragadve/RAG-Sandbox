const { CartesiaClient } = require('@cartesia/cartesia-js');

const apiKey = "sk_car_13Kgj5Unm8zyTqZ7AiyteG";
const cartesia = new CartesiaClient({ apiKey });

async function listVoices() {
    try {
        const voices = await cartesia.voices.list();
        console.log("--- START VOICES ---");
        // Filter for English voices if possible or just take first few
        const englishVoices = voices.filter(v => v.language === 'en' || !v.language).slice(0, 5);

        englishVoices.forEach(v => {
            console.log(`ID:${v.id}|NAME:${v.name}`);
        });
        console.log("--- END VOICES ---");
    } catch (error) {
        console.error("Error:", error);
    }
}

listVoices();
