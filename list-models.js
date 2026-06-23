import fetch from 'node-fetch';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

async function getModelDetails(modelName) {
    console.log(`Getting details for ${modelName}...`);
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${modelName}?key=${apiKey}`,
            { method: "GET" },
        );
        const data = await response.json();
        console.log(`✅ Details for ${modelName}:`);
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.log(`❌ Error: ${err.message}`);
    }
}

// Check gemini-3.5-flash specifically
getModelDetails('models/gemini-3.5-flash');
