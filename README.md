# InvestAI Financial App

A modern financial dashboard application built with React, TypeScript, and Vite. Track stocks in real-time, manage your portfolio, get AI-powered insights, and stay updated with the latest financial news.

![InvestAI Dashboard](https://via.placeholder.com/800x400/0f172a/ffffff?text=InvestAI+Financial+Dashboard)

## ✨ Features

### 📊 Real-Time Stock Data
- Track 78+ stocks across 20+ sectors in real-time
- Live price updates from Yahoo Finance API
- Interactive charts with price history and volume data
- Search functionality to find stocks quickly
- Filter by sector: Technology, Healthcare, Finance, Energy, and more

### 💼 Portfolio Management
- Add, edit, and delete stock holdings
- Real-time portfolio value calculation
- Track total shares and individual stock performance
- Persistent storage with Firebase Firestore
- Watchlist functionality with price alerts

### 🤖 AI-Powered Insights
- Market sentiment analysis powered by Google Gemini AI
- Personalized stock recommendations
- Portfolio diversification analysis
- Risk assessment and growth predictions
- Dynamic market trend analysis

### 📰 Financial News
- Curated financial news in blog-style layout
- Full article view with modal dialogs
- Beautiful imagery from Unsplash
- Stay updated with market-moving news

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Gemini API key ([Get it here](https://aistudio.google.com/app/apikey))
- Firebase project ([Create one here](https://console.firebase.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd figma-prototype
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Gemini API Key
   VITE_GEMINI_API_KEY=your_gemini_api_key_here

   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   
   # App Instance ID (for shared Firestore databases)
   VITE_FIREBASE_APP_INSTANCE_ID=financial-app
   ```

4. **Enable Firestore Database**
   
   Follow the instructions in [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) to:
   - Create a Firebase project
   - Enable Firestore Database
   - Get your configuration credentials

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 🏗️ Project Structure

```
figma-prototype/
├── components/           # React components
│   ├── ui/              # shadcn/ui components (Button, Card, Dialog, etc.)
│   ├── Dashboard.tsx    # Main dashboard with stock charts
│   ├── Portfolio.tsx    # Portfolio management page
│   ├── AIInsights.tsx   # AI-powered insights page
│   ├── News.tsx         # Financial news page
│   └── StockChart.tsx   # Stock chart component
├── contexts/            # React Context providers
│   ├── DataContext.tsx  # Stock data management
│   └── PortfolioContext.tsx  # Portfolio state management
├── services/            # External service integrations
│   └── aiService.ts     # Google Gemini AI integration
├── config/              # Configuration files
│   └── firebase.ts      # Firebase initialization
├── data/                # Static data
│   └── mockData.ts      # Stock and news data
├── styles/              # Global styles
│   └── globals.css      # Tailwind CSS styles
├── .env                 # Environment variables (not committed)
├── .env.example         # Example environment variables
└── App.tsx              # Main application component
```

## 🛠️ Tech Stack

- **Frontend Framework**: React 18.3.1 + TypeScript
- **Build Tool**: Vite 6.4.1
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui + Radix UI
- **Charts**: Recharts
- **Icons**: Lucide React
- **Stock Data**: Yahoo Finance API (via CORS proxy)
- **AI Insights**: Google Gemini 1.5 Flash API
- **Database**: Firebase Firestore
- **Deployment**: Vercel-ready

## 📦 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## 🔑 API Keys & Configuration

### Google Gemini API
- Free tier: 1,500 requests/day
- Get your API key: https://aistudio.google.com/app/apikey
- Add to `.env` as `VITE_GEMINI_API_KEY`

### Firebase Firestore
- Free tier: 50K reads, 20K writes per day
- Create project: https://console.firebase.google.com/
- See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed setup

### Yahoo Finance API
- Used via free CORS proxy (corsproxy.io)
- No API key required
- Fetches real-time stock data for 78+ stocks

## 🌐 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add Environment Variables**
   
   In Vercel project settings, add all variables from your `.env` file:
   - `VITE_GEMINI_API_KEY`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_APP_INSTANCE_ID`

4. **Deploy**
   
   Vercel will automatically build and deploy your app!

## 📊 Supported Stocks

The app tracks 78+ stocks across 20+ sectors including:

- **Technology**: Apple (AAPL), Microsoft (MSFT), Google (GOOGL), NVIDIA (NVDA)
- **Finance**: JPMorgan (JPM), Bank of America (BAC), Goldman Sachs (GS)
- **Healthcare**: Johnson & Johnson (JNJ), Pfizer (PFE), UnitedHealth (UNH)
- **Consumer**: Amazon (AMZN), Tesla (TSLA), Nike (NKE), Starbucks (SBUX)
- **Energy**: ExxonMobil (XOM), Chevron (CVX), ConocoPhillips (COP)
- And many more...

## 🔒 Security

- ✅ All API keys stored in `.env` (not committed to Git)
- ✅ Firebase security rules for authenticated users
- ✅ Environment variables used throughout the app
- ✅ `.gitignore` configured to exclude sensitive files
- ✅ Separate Firestore collections per app instance

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Yahoo Finance](https://finance.yahoo.com/) for stock data
- [Google Gemini](https://ai.google.dev/) for AI insights
- [Firebase](https://firebase.google.com/) for database
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Recharts](https://recharts.org/) for data visualization
- [Unsplash](https://unsplash.com/) for stock imagery

## 📧 Support

For questions or support, please open an issue on GitHub.

---

Built with ❤️ using React + TypeScript + Vite

## Features in Detail

### Dashboard
- Portfolio value tracking
- Market status indicator
- Stock cards with key metrics
- 30-day price charts
- Refresh functionality

### Stock Comparison
- Sortable comparison table
- Search by symbol or name
- Filter by performance (gainers/losers)
- Summary statistics

### News Feed
- Latest market news
- Sentiment indicators
- Category filtering
- Related stock tags

### AI Insights
- Buy/Hold/Sell recommendations with confidence scores
- Market trend analysis
- Risk alerts with recommendations
- Powered by Groq's Llama 3.3 70B model

### Portfolio
- Holdings with performance tracking
- Watchlist management
- Custom price alerts
- Best/worst performer tracking

## Development Tips

- The app uses mock data as fallback when APIs are unavailable
- API responses are cached for 1 minute to reduce API calls
- All components use shadcn/ui for consistent styling
- TypeScript provides full type safety

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
