const url = 'https://www.annuaire-medical.cm/fr/pharmacies-de-garde/centre/pharmacies-de-garde-yaounde';
async function testFetch() {
    try {
        console.log('Testing connection to:', url);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        console.log('Status:', response.status);
        if (response.ok) {
            const text = await response.text();
            console.log('Content length:', text.length);
        }
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}
testFetch();
