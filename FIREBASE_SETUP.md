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
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_actual_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# App Instance ID (unique identifier for this app in shared Firestore)
VITE_FIREBASE_APP_INSTANCE_ID=financial-app
```

**Note:** 
- Never commit your `.env` file to version control. It's already in `.gitignore`.
- The `VITE_FIREBASE_APP_INSTANCE_ID` creates a separate collection (`portfolios_financial-app`) in Firestore, allowing you to use the same database for multiple projects without conflicts.

## 4. Enable Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location closest to your users
5. Click "Enable"

## 5. Set Firestore Rules (Optional - For Production)

For development, test mode works fine. For production, update rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /portfolios/{portfolioId} {
      allow read, write: if request.auth != null; // Only authenticated users
    }
  }
}
```

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
