import fetch from 'node-fetch'; // Assumes node-fetch is available, or use global fetch if Node 18+
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const modelsToTest = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"];

async function testModel(model) {
    console.log(`Testing model: ${model}...`);
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Hello" }] }],
                }),
            },
        );

        const data = await response.json();
        if (response.ok) {
            console.log(`✅ ${model}: Success!`);
        } else {
            console.log(`❌ ${model}: Failed with status ${response.status}`);
            console.log(`   Response:`, JSON.stringify(data));
        }
    } catch (err) {
        console.log(`❌ ${model}: Error - ${err.message}`);
    }
}

async function runTests() {
    for (const model of modelsToTest) {
        await testModel(model);
    }
}

runTests();
