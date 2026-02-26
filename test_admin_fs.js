console.log("Testing main firebase-admin import...");
import admin from 'firebase-admin';
console.log("Success admin");
const db = admin.getFirestore();
console.log("Success getFirestore");
