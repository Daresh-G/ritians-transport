
import fetch from 'node-fetch';

const BASE = 'http://localhost:3000/api';

async function testAll() {
    const creds = [
        { email: 'daresh928@gmail.com', pw: 'dare1911', role: 'admin' },
        { email: 'daresh928@gmail.com', pw: 'dare1911', role: 'driver' },
        { email: 'daresh1911g@gmail.com', pw: '2241428', role: 'admin' }
    ];

    for (const c of creds) {
        console.log(`Testing ${c.role} login for ${c.email}...`);
        try {
            const res = await fetch(`${BASE}/login/${c.role}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: c.email, password: c.pw })
            });
            const data = await res.json();
            console.log(`Result: ${res.status} ${data.success ? 'SUCCESS' : 'FAILED'} ${data.error || ''}`);
        } catch (e) { console.log("Error:", e.message); }
    }
}

testAll();
