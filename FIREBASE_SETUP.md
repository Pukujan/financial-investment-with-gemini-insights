# Firebase Setup Instructions

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name (e.g., "InvestAI-Portfolio")
4. Follow the setup wizard

## 2. Get Firebase Configuration

1. In your Firebase project, click the gear icon (⚙️) → Project settings
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

## 3. Update Firebase Configuration

Open `.env` file in the root directory and replace the placeholder values with your actual Firebase credentials:

```env
# Backend only (root .env) — never expose in frontend
FIREBASE_API_KEY=your_actual_api_key_here
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
FIREBASE_APP_INSTANCE_ID=financial-app

OPENROUTER_API_KEY=sk-or-v1-your_key_here
OPENROUTER_MODEL_PRIMARY=deepseek/deepseek-chat-v3-0324
OPENROUTER_MODEL_FALLBACK=qwen/qwen3.5-flash-02-23
```

**Note:** 
- Never commit your `.env` file to version control. It's already in `.gitignore`.
- Firestore is accessed from `apps/backend` only. `FIREBASE_APP_INSTANCE_ID` namespaces collections (e.g. `portfolios_financial-app`).

## 4. Enable Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location closest to your users
5. Click "Enable"

## 5. Deploy Firestore Rules (required for Railway / production)

The backend writes cache docs with the **client SDK** (no Firebase Auth session). Default “test mode” rules expire; locked-down rules cause `permission-denied` in logs.

1. Install Firebase CLI: `npm i -g firebase-tools`
2. From repo root: `firebase login` then `firebase use <your-project-id>`
3. Deploy: `firebase deploy --only firestore:rules`

Rules live in [`firestore.rules`](./firestore.rules) and allow the collections in `apps/backend/src/config/cache.ts` (`marketBulkCache`, `agentBulkCache`, `aiInsights`, `portfolios_<instanceId>`, etc.).

For stricter production security, migrate the backend to the **Firebase Admin SDK** with a service account instead of widening client rules.

## How It Works

- **Portfolio Data**: All portfolio holdings are automatically saved to Firebase
- **Real-time Sync**: Add, edit, or delete holdings and they're instantly saved
- **Persistent Storage**: Your portfolio data persists across browser sessions
- **Auto-loading**: Portfolio loads automatically when you visit the app

## Data Structure

Your portfolio is stored in Firestore at:
- Collection: `portfolios`
- Document ID: `user_portfolio`
- Fields:
  - `holdings`: Array of stock holdings
  - `lastUpdated`: Timestamp of last update

## Testing

1. Add a stock to your portfolio
2. Refresh the page
3. Your portfolio should still be there!
4. Check Firebase Console → Firestore Database to see your data

## Troubleshooting

- **Error connecting**: Check your Firebase config credentials
- **Permission denied**: Ensure Firestore rules allow read/write
- **Data not saving**: Check browser console for errors
