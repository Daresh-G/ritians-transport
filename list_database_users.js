
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

if (!serviceAccount) throw new Error("Service account file missing");

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function listUsers() {
    try {
        console.log("--- START LISTING ---");
        const snapshot = await db.collection('authority').get();
        if (snapshot.empty) {
            console.log("No users found in 'authority' collection.");
        }
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = data.email || "NO EMAIL";
            const role = data.role || "NO ROLE";
            const pw = data.password ? (data.password.startsWith('$2') ? '[ENCRYPTED]' : data.password) : "NO PASSWORD";
            console.log(`USER: ${email} | ROLE: ${role} | PW: ${pw}`);
        });
        console.log("--- END LISTING ---");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

listUsers();
