# 🚀 Ritians Transport - Deployment Instructions

I have unified your frontend and backend. Both will now run on a single port (3000) from your perspective.

## 🏁 Final Step to Publish (Render.com)

1.  **Log in to Render**: Go to [https://dashboard.render.com](https://dashboard.render.com).
2.  **Create New Service**: Click **"New +"** -> **"Web Service"**.
3.  **Connect GitHub**: Select your repository: `DARESH-G/ritians-transport`.
4.  **Confirm Settings**:
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `node server.js`
5.  **Environment Variables**: Go to the **"Environment"** tab and add:
    *   `FIREBASE_SERVICE_ACCOUNT`: (Paste the contents of your `service-account.json`)
    *   `JWT_SECRET`: (Any secure password)
    *   `ADMIN_EMAIL`: `daresh928@gmail.com`
    *   `MASTER_KEY`: `ritians-setup-key-2025`
    *   `NODE_ENV`: `production`

## 🛠️ Local Development
To run the app locally:
```powershell
npm run dev
```
Visit: `http://localhost:3000`

## 📁 Repository
Your code is fully updated here: [https://github.com/Daresh-G/ritians-transport](https://github.com/Daresh-G/ritians-transport)
