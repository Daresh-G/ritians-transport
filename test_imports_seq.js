console.log("Testing imports...");
try {
    console.log("1. express");
    await import('express');
    console.log("2. path");
    await import('path');
    console.log("3. cors");
    await import('cors');
    console.log("4. body-parser");
    await import('body-parser');
    console.log("5. firebase-admin/app");
    await import('firebase-admin/app');
    console.log("6. firebase-admin/firestore");
    await import('firebase-admin/firestore');
    console.log("7. firebase-admin/database");
    await import('firebase-admin/database');
    console.log("8. bcryptjs");
    await import('bcryptjs');
    console.log("9. jsonwebtoken");
    await import('jsonwebtoken');
    console.log("10. dotenv");
    await import('dotenv');
    console.log("SUCCESS: All imports loaded");
} catch (e) {
    console.error("CRASH detected in imports:", e);
}
