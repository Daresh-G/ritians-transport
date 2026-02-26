import { initializeApp, cert } from 'firebase-admin/app';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

console.log("Starting Firebase Admin...");
try {
    initializeApp({
        credential: cert(serviceAccount),
        databaseURL: "https://ritians-transport-default-rtdb.asia-southeast1.firebasedatabase.app/"
    });
    console.log("Firebase Admin Initialized");
} catch (e) {
    console.error("Initialization failed", e);
}
console.log("Done");
