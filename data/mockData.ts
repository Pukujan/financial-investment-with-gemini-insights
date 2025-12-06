export const mockStocks = [
  // Technology
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.42, change: 2.34, changePercent: 1.33, marketCap: '$2.8T', volume: '52.3M', pe: 29.8, sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.91, change: 5.67, changePercent: 1.52, marketCap: '$2.9T', volume: '31.2M', pe: 35.2, sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.65, change: -1.23, changePercent: -0.85, marketCap: '$1.8T', volume: '28.1M', pe: 26.5, sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 334.88, change: 8.92, changePercent: 2.74, marketCap: '$850B', volume: '18.9M', pe: 28.9, sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 495.22, change: 12.34, changePercent: 2.56, marketCap: '$1.2T', volume: '42.3M', pe: 105.6, sector: 'Technology' },
  { symbol: 'ADBE', name: 'Adobe Inc.', price: 562.18, change: 7.45, changePercent: 1.34, marketCap: '$260B', volume: '2.8M', pe: 45.3, sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce Inc.', price: 267.89, change: 3.21, changePercent: 1.21, marketCap: '$260B', volume: '5.6M', pe: 48.7, sector: 'Technology' },
  { symbol: 'ORCL', name: 'Oracle Corporation', price: 118.45, change: 2.15, changePercent: 1.85, marketCap: '$325B', volume: '8.7M', pe: 35.2, sector: 'Technology' },
  { symbol: 'INTC', name: 'Intel Corporation', price: 42.67, change: -0.89, changePercent: -2.04, marketCap: '$175B', volume: '45.3M', pe: 22.1, sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 145.32, change: 5.67, changePercent: 4.06, marketCap: '$235B', volume: '78.9M', pe: 68.4, sector: 'Technology' },

  // Consumer Cyclical
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 146.57, change: 3.21, changePercent: 2.24, marketCap: '$1.5T', volume: '45.6M', pe: 68.3, sector: 'Consumer Cyclical' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 238.45, change: -4.56, changePercent: -1.88, marketCap: '$757B', volume: '98.7M', pe: 75.4, sector: 'Consumer Cyclical' },
  { symbol: 'NKE', name: 'Nike Inc.', price: 108.76, change: 1.45, changePercent: 1.35, marketCap: '$165B', volume: '6.7M', pe: 32.4, sector: 'Consumer Cyclical' },
  { symbol: 'MCD', name: "McDonald's Corporation", price: 289.34, change: 2.78, changePercent: 0.97, marketCap: '$210B', volume: '2.9M', pe: 24.8, sector: 'Consumer Cyclical' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', price: 98.45, change: -1.23, changePercent: -1.23, marketCap: '$115B', volume: '7.8M', pe: 28.6, sector: 'Consumer Cyclical' },
  { symbol: 'HD', name: 'The Home Depot Inc.', price: 345.67, change: 4.32, changePercent: 1.27, marketCap: '$350B', volume: '3.2M', pe: 22.5, sector: 'Consumer Cyclical' },
  { symbol: 'LOW', name: "Lowe's Companies Inc.", price: 234.56, change: 3.21, changePercent: 1.39, marketCap: '$145B', volume: '4.1M', pe: 19.8, sector: 'Consumer Cyclical' },

  // Communication Services
  { symbol: 'NFLX', name: 'Netflix Inc.', price: 478.33, change: -2.45, changePercent: -0.51, marketCap: '$210B', volume: '12.8M', pe: 44.7, sector: 'Communication Services' },
  { symbol: 'DIS', name: 'The Walt Disney Company', price: 91.23, change: 1.56, changePercent: 1.74, marketCap: '$167B', volume: '11.2M', pe: 65.3, sector: 'Communication Services' },
  { symbol: 'CMCSA', name: 'Comcast Corporation', price: 43.21, change: 0.45, changePercent: 1.05, marketCap: '$175B', volume: '18.9M', pe: 14.2, sector: 'Communication Services' },
  { symbol: 'T', name: 'AT&T Inc.', price: 16.78, change: -0.12, changePercent: -0.71, marketCap: '$120B', volume: '42.3M', pe: 8.9, sector: 'Communication Services' },
  { symbol: 'VZ', name: 'Verizon Communications', price: 38.94, change: 0.34, changePercent: 0.88, marketCap: '$163B', volume: '16.7M', pe: 9.5, sector: 'Communication Services' },

  // Healthcare
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 156.78, change: 1.23, changePercent: 0.79, marketCap: '$380B', volume: '7.8M', pe: 15.6, sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', price: 523.45, change: 6.78, changePercent: 1.31, marketCap: '$490B', volume: '2.9M', pe: 24.3, sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer Inc.', price: 28.67, change: -0.45, changePercent: -1.55, marketCap: '$162B', volume: '48.9M', pe: 11.2, sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', price: 167.89, change: 2.34, changePercent: 1.41, marketCap: '$296B', volume: '6.2M', pe: 38.7, sector: 'Healthcare' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific', price: 548.23, change: 7.89, changePercent: 1.46, marketCap: '$215B', volume: '1.4M', pe: 35.2, sector: 'Healthcare' },
  { symbol: 'ABT', name: 'Abbott Laboratories', price: 109.45, change: 1.56, changePercent: 1.45, marketCap: '$190B', volume: '5.6M', pe: 28.9, sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly and Company', price: 587.34, change: 12.45, changePercent: 2.17, marketCap: '$560B', volume: '3.2M', pe: 72.4, sector: 'Healthcare' },

  // Financial Services
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 189.67, change: 3.45, changePercent: 1.85, marketCap: '$550B', volume: '11.2M', pe: 11.8, sector: 'Financial Services' },
  { symbol: 'BAC', name: 'Bank of America Corp.', price: 34.56, change: 0.89, changePercent: 2.64, marketCap: '$280B', volume: '45.6M', pe: 10.2, sector: 'Financial Services' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', price: 52.34, change: 1.23, changePercent: 2.41, marketCap: '$195B', volume: '23.4M', pe: 12.5, sector: 'Financial Services' },
  { symbol: 'GS', name: 'The Goldman Sachs Group', price: 387.45, change: 5.67, changePercent: 1.49, marketCap: '$135B', volume: '2.1M', pe: 13.7, sector: 'Financial Services' },
  { symbol: 'MS', name: 'Morgan Stanley', price: 94.23, change: 1.78, changePercent: 1.93, marketCap: '$156B', volume: '8.9M', pe: 14.3, sector: 'Financial Services' },
  { symbol: 'V', name: 'Visa Inc.', price: 267.89, change: 4.56, changePercent: 1.73, marketCap: '$565B', volume: '6.7M', pe: 32.1, sector: 'Financial Services' },
  { symbol: 'MA', name: 'Mastercard Inc.', price: 428.34, change: 6.78, changePercent: 1.61, marketCap: '$410B', volume: '3.4M', pe: 38.9, sector: 'Financial Services' },

  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', price: 102.34, change: 2.45, changePercent: 2.45, marketCap: '$420B', volume: '18.9M', pe: 9.8, sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron Corporation', price: 156.78, change: 3.21, changePercent: 2.09, marketCap: '$295B', volume: '8.7M', pe: 10.5, sector: 'Energy' },
  { symbol: 'COP', name: 'ConocoPhillips', price: 118.45, change: 2.34, changePercent: 2.02, marketCap: '$145B', volume: '7.8M', pe: 11.2, sector: 'Energy' },
  { symbol: 'SLB', name: 'Schlumberger Limited', price: 52.67, change: 1.45, changePercent: 2.83, marketCap: '$75B', volume: '12.3M', pe: 14.7, sector: 'Energy' },

  // Consumer Defensive
  { symbol: 'PG', name: 'The Procter & Gamble Co.', price: 156.78, change: 1.23, changePercent: 0.79, marketCap: '$370B', volume: '7.2M', pe: 25.4, sector: 'Consumer Defensive' },
  { symbol: 'KO', name: 'The Coca-Cola Company', price: 58.34, change: 0.67, changePercent: 1.16, marketCap: '$252B', volume: '15.6M', pe: 24.8, sector: 'Consumer Defensive' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', price: 168.45, change: 1.89, changePercent: 1.13, marketCap: '$233B', volume: '4.9M', pe: 23.7, sector: 'Consumer Defensive' },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 167.89, change: 2.34, changePercent: 1.41, marketCap: '$450B', volume: '8.1M', pe: 28.6, sector: 'Consumer Defensive' },
  { symbol: 'COST', name: 'Costco Wholesale Corp.', price: 712.34, change: 9.45, changePercent: 1.34, marketCap: '$315B', volume: '2.3M', pe: 45.2, sector: 'Consumer Defensive' },

  // Industrials
  { symbol: 'BA', name: 'The Boeing Company', price: 198.67, change: -2.34, changePercent: -1.16, marketCap: '$122B', volume: '6.8M', pe: -15.2, sector: 'Industrials' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', price: 287.45, change: 4.56, changePercent: 1.61, marketCap: '$150B', volume: '3.2M', pe: 16.8, sector: 'Industrials' },
  { symbol: 'GE', name: 'General Electric Company', price: 128.34, change: 3.21, changePercent: 2.56, marketCap: '$141B', volume: '7.9M', pe: 24.3, sector: 'Industrials' },
  { symbol: 'MMM', name: '3M Company', price: 89.23, change: 1.45, changePercent: 1.65, marketCap: '$50B', volume: '4.2M', pe: 18.9, sector: 'Industrials' },
  { symbol: 'UPS', name: 'United Parcel Service', price: 152.67, change: 2.34, changePercent: 1.56, marketCap: '$131B', volume: '3.6M', pe: 19.7, sector: 'Industrials' },

  // Real Estate
  { symbol: 'AMT', name: 'American Tower Corp.', price: 198.45, change: 2.67, changePercent: 1.36, marketCap: '$91B', volume: '1.8M', pe: 45.3, sector: 'Real Estate' },
  { symbol: 'PLD', name: 'Prologis Inc.', price: 128.67, change: 1.89, changePercent: 1.49, marketCap: '$119B', volume: '2.9M', pe: 38.7, sector: 'Real Estate' },
  { symbol: 'SPG', name: 'Simon Property Group', price: 143.21, change: 2.34, changePercent: 1.66, marketCap: '$47B', volume: '1.9M', pe: 22.4, sector: 'Real Estate' },

  // Materials
  { symbol: 'LIN', name: 'Linde plc', price: 432.56, change: 5.67, changePercent: 1.33, marketCap: '$215B', volume: '1.6M', pe: 34.2, sector: 'Materials' },
  { symbol: 'APD', name: 'Air Products and Chemicals', price: 289.34, change: 3.45, changePercent: 1.21, marketCap: '$64B', volume: '1.2M', pe: 28.9, sector: 'Materials' },
  { symbol: 'SHW', name: 'The Sherwin-Williams Co.', price: 312.45, change: 4.23, changePercent: 1.37, marketCap: '$80B', volume: '0.9M', pe: 35.6, sector: 'Materials' },

  // Utilities
  { symbol: 'NEE', name: 'NextEra Energy Inc.', price: 58.34, change: 0.89, changePercent: 1.55, marketCap: '$118B', volume: '9.2M', pe: 18.7, sector: 'Utilities' },
  { symbol: 'DUK', name: 'Duke Energy Corporation', price: 98.67, change: 1.23, changePercent: 1.26, marketCap: '$76B', volume: '3.4M', pe: 19.4, sector: 'Utilities' },
  { symbol: 'SO', name: 'The Southern Company', price: 72.34, change: 0.67, changePercent: 0.93, marketCap: '$77B', volume: '4.1M', pe: 18.2, sector: 'Utilities' },

  // Biotechnology
  { symbol: 'GILD', name: 'Gilead Sciences Inc.', price: 78.45, change: 1.34, changePercent: 1.74, marketCap: '$98B', volume: '6.7M', pe: 16.3, sector: 'Biotechnology' },
  { symbol: 'AMGN', name: 'Amgen Inc.', price: 287.56, change: 3.67, changePercent: 1.29, marketCap: '$156B', volume: '2.4M', pe: 22.7, sector: 'Biotechnology' },
  { symbol: 'BIIB', name: 'Biogen Inc.', price: 234.67, change: 4.56, changePercent: 1.98, marketCap: '$34B', volume: '1.3M', pe: 15.8, sector: 'Biotechnology' },

  // Semiconductors
  { symbol: 'AVGO', name: 'Broadcom Inc.', price: 1234.56, change: 23.45, changePercent: 1.94, marketCap: '$510B', volume: '2.1M', pe: 68.9, sector: 'Semiconductors' },
  { symbol: 'TXN', name: 'Texas Instruments Inc.', price: 178.34, change: 2.67, changePercent: 1.52, marketCap: '$162B', volume: '4.8M', pe: 24.3, sector: 'Semiconductors' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.', price: 145.67, change: 3.21, changePercent: 2.25, marketCap: '$163B', volume: '9.2M', pe: 18.7, sector: 'Semiconductors' },
  { symbol: 'MU', name: 'Micron Technology Inc.', price: 89.34, change: 2.45, changePercent: 2.82, marketCap: '$97B', volume: '18.9M', pe: 28.4, sector: 'Semiconductors' },

  // Automotive
  { symbol: 'F', name: 'Ford Motor Company', price: 12.34, change: 0.23, changePercent: 1.90, marketCap: '$49B', volume: '67.8M', pe: 6.2, sector: 'Automotive' },
  { symbol: 'GM', name: 'General Motors Company', price: 36.78, change: 0.89, changePercent: 2.48, marketCap: '$52B', volume: '23.4M', pe: 5.8, sector: 'Automotive' },
  { symbol: 'TM', name: 'Toyota Motor Corporation', price: 198.45, change: 3.21, changePercent: 1.64, marketCap: '$268B', volume: '2.1M', pe: 9.3, sector: 'Automotive' },

  // Aerospace & Defense
  { symbol: 'LMT', name: 'Lockheed Martin Corp.', price: 456.78, change: 5.67, changePercent: 1.26, marketCap: '$115B', volume: '1.2M', pe: 18.9, sector: 'Aerospace & Defense' },
  { symbol: 'RTX', name: 'RTX Corporation', price: 98.34, change: 1.45, changePercent: 1.50, marketCap: '$142B', volume: '5.6M', pe: 24.3, sector: 'Aerospace & Defense' },
  { symbol: 'NOC', name: 'Northrop Grumman Corp.', price: 467.89, change: 6.78, changePercent: 1.47, marketCap: '$70B', volume: '0.8M', pe: 14.7, sector: 'Aerospace & Defense' },

  // Pharmaceuticals
  { symbol: 'MRK', name: 'Merck & Co. Inc.', price: 108.45, change: 1.67, changePercent: 1.56, marketCap: '$275B', volume: '9.8M', pe: 16.7, sector: 'Pharmaceuticals' },
  { symbol: 'NVO', name: 'Novo Nordisk A/S', price: 112.34, change: 2.34, changePercent: 2.13, marketCap: '$505B', volume: '4.2M', pe: 38.9, sector: 'Pharmaceuticals' },
  { symbol: 'AZN', name: 'AstraZeneca PLC', price: 67.89, change: 1.23, changePercent: 1.84, marketCap: '$210B', volume: '5.6M', pe: 35.2, sector: 'Pharmaceuticals' },

  // Entertainment
  { symbol: 'SPOT', name: 'Spotify Technology S.A.', price: 187.45, change: 4.56, changePercent: 2.49, marketCap: '$36B', volume: '2.9M', pe: -45.2, sector: 'Entertainment' },
  { symbol: 'EA', name: 'Electronic Arts Inc.', price: 134.67, change: 2.34, changePercent: 1.77, marketCap: '$37B', volume: '2.1M', pe: 28.9, sector: 'Entertainment' },
  { symbol: 'TTWO', name: 'Take-Two Interactive', price: 156.78, change: 3.45, changePercent: 2.25, marketCap: '$28B', volume: '1.8M', pe: 32.4, sector: 'Entertainment' },

  // E-commerce
  { symbol: 'SHOP', name: 'Shopify Inc.', price: 78.34, change: 2.67, changePercent: 3.53, marketCap: '$98B', volume: '8.9M', pe: -65.3, sector: 'E-commerce' },
  { symbol: 'MELI', name: 'MercadoLibre Inc.', price: 1567.89, change: 34.56, changePercent: 2.25, marketCap: '$79B', volume: '0.5M', pe: 68.7, sector: 'E-commerce' },

  // Cybersecurity
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: 267.89, change: 8.45, changePercent: 3.26, marketCap: '$62B', volume: '4.2M', pe: -89.4, sector: 'Cybersecurity' },
  { symbol: 'PANW', name: 'Palo Alto Networks', price: 298.45, change: 7.23, changePercent: 2.48, marketCap: '$95B', volume: '3.8M', pe: 45.6, sector: 'Cybersecurity' },
  { symbol: 'FTNT', name: 'Fortinet Inc.', price: 62.34, change: 1.56, changePercent: 2.57, marketCap: '$48B', volume: '5.1M', pe: 38.2, sector: 'Cybersecurity' },
];

export const mockNews = [
  {
    title: 'Tech Giants Report Strong Q4 Earnings',
    summary: 'Major technology companies exceeded Wall Street expectations with robust quarterly earnings, driven by cloud computing and AI investments.',
    category: 'Earnings',
    time: '3 hours ago',
    relatedStocks: ['AAPL', 'MSFT', 'GOOGL'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop',
    author: 'Financial Times',
    content: 'Technology sector leaders delivered impressive quarterly results that surpassed analyst expectations across the board. The performance was primarily driven by accelerated adoption of artificial intelligence technologies and continued growth in cloud computing services. Industry experts predict this trend will continue through 2025 as enterprises increase their digital transformation investments.',
  },
  {
    title: 'Federal Reserve Signals Potential Rate Cuts',
    summary: 'Fed officials indicate openness to rate reductions in 2024 as inflation shows signs of moderating.',
    category: 'Economy',
    time: '5 hours ago',
    relatedStocks: ['SPY', 'QQQ'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop',
    author: 'Bloomberg',
    content: 'The Federal Reserve has hinted at a more dovish stance in upcoming meetings, suggesting that interest rate cuts may be on the table as inflation continues its downward trajectory. Economic indicators show cooling price pressures while employment remains strong, creating what many economists call a "soft landing" scenario. Market participants are pricing in multiple rate cuts over the next 12 months.',
  },
  {
    title: 'Electric Vehicle Sales Surge in Q4',
    summary: 'EV manufacturers report record deliveries despite economic headwinds, with Tesla leading the charge.',
    category: 'Technology',
    time: '7 hours ago',
    relatedStocks: ['TSLA', 'F', 'GM'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800&h=400&fit=crop',
    author: 'Reuters',
    content: 'Electric vehicle manufacturers delivered record numbers in the fourth quarter, signaling robust consumer demand despite broader economic concerns. Tesla maintained its market leadership with innovative pricing strategies and expanded production capacity. Traditional automakers like Ford and GM are rapidly gaining ground with their new EV lineups, intensifying competition in this growing market segment.',
  },
  {
    title: 'Amazon Announces Major Cloud Expansion',
    summary: 'AWS unveils plans for new data centers across Asia-Pacific region, signaling continued growth in cloud infrastructure.',
    category: 'Technology',
    time: '1 day ago',
    relatedStocks: ['AMZN'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop',
    author: 'TechCrunch',
    content: 'Amazon Web Services announced a multi-billion dollar investment in new data center infrastructure across the Asia-Pacific region. This expansion demonstrates AWS\'s commitment to meeting growing demand for cloud services in emerging markets. The new facilities will support AI workloads, machine learning applications, and general computing needs for enterprise customers.',
  },
  {
    title: 'Meta Faces Regulatory Challenges in EU',
    summary: 'European regulators propose new restrictions on data collection practices, potentially impacting advertising revenue.',
    category: 'Markets',
    time: '1 day ago',
    relatedStocks: ['META'],
    sentiment: 'negative' as const,
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&h=400&fit=crop',
    author: 'Wall Street Journal',
    content: 'Meta Platforms faces new regulatory headwinds in Europe as policymakers propose stricter data privacy rules. The proposed regulations could significantly impact the company\'s ability to collect user data for targeted advertising, potentially affecting revenue streams. Meta has expressed concerns about the economic impact while pledging to work with regulators to find balanced solutions.',
  },
  {
    title: 'NVIDIA Partners with Major Auto Manufacturers',
    summary: 'Chipmaker secures deals to power next-generation autonomous vehicle systems with AI processors.',
    category: 'Technology',
    time: '2 days ago',
    relatedStocks: ['NVDA', 'TM', 'F'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&h=400&fit=crop',
    author: 'CNBC',
    content: 'NVIDIA announced strategic partnerships with leading automotive manufacturers to integrate its advanced AI computing platforms into next-generation vehicles. The deals position NVIDIA as a key player in the autonomous driving revolution, with its chips powering everything from advanced driver assistance to fully autonomous systems. Analysts view this as a significant growth opportunity beyond traditional gaming and data center markets.',
  },
  {
    title: 'Biotech Breakthrough in Cancer Treatment',
    summary: 'New immunotherapy shows promising results in clinical trials, offering hope for difficult-to-treat cancers.',
    category: 'Healthcare',
    time: '2 days ago',
    relatedStocks: ['LLY', 'GILD', 'BIIB'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&h=400&fit=crop',
    author: 'Medical News Today',
    content: 'A groundbreaking immunotherapy treatment has demonstrated exceptional efficacy in Phase 3 clinical trials for previously untreatable cancer types. The therapy represents a new class of treatment that harnesses the body\'s immune system to target cancer cells more effectively. Medical experts are calling it a potential game-changer in oncology, with FDA approval expected within the year.',
  },
  {
    title: 'Streaming Wars Intensify with New Players',
    summary: 'Major tech companies launch competing streaming platforms, reshaping entertainment landscape.',
    category: 'Entertainment',
    time: '3 days ago',
    relatedStocks: ['NFLX', 'DIS', 'SPOT'],
    sentiment: 'neutral' as const,
    imageUrl: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&h=400&fit=crop',
    author: 'Variety',
    content: 'The streaming entertainment market continues to evolve as new entrants challenge established players. Content creation budgets are reaching unprecedented levels as platforms compete for subscriber attention. While Netflix maintains its leadership position, Disney+ and other competitors are rapidly gaining ground through exclusive content and competitive pricing strategies.',
  },
  {
    title: 'Cybersecurity Threats Surge, Industry Responds',
    summary: 'Rising cyberattacks prompt increased spending on security solutions across enterprises.',
    category: 'Technology',
    time: '3 days ago',
    relatedStocks: ['CRWD', 'PANW', 'FTNT'],
    sentiment: 'neutral' as const,
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=400&fit=crop',
    author: 'Security Week',
    content: 'Enterprise cybersecurity spending is accelerating as organizations face increasingly sophisticated threats. Recent high-profile breaches have highlighted vulnerabilities in legacy systems, driving demand for next-generation security solutions. Leading cybersecurity firms report record bookings as CISOs prioritize protection of critical infrastructure and sensitive data.',
  },
  {
    title: 'Renewable Energy Sector Sees Record Investment',
    summary: 'Global clean energy investments reach all-time high as nations pursue carbon neutrality goals.',
    category: 'Energy',
    time: '4 days ago',
    relatedStocks: ['NEE', 'ENPH'],
    sentiment: 'positive' as const,
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=400&fit=crop',
    author: 'Energy Today',
    content: 'Investment in renewable energy infrastructure has reached record levels as countries accelerate efforts to meet carbon neutrality targets. Solar and wind projects are attracting unprecedented funding, driven by improving economics and supportive government policies. Industry analysts predict this trend will continue as technology advances and costs decline further.',
  },
];

export const mockInsights = {
  recommendations: [
    {
      symbol: 'NVDA',
      company: 'NVIDIA Corp.',
      action: 'Buy' as const,
      confidence: 87,
      targetPrice: '$580.00',
      reason: 'Strong AI demand and recent partnerships signal continued growth potential.',
    },
    {
      symbol: 'AAPL',
      company: 'Apple Inc.',
      action: 'Hold' as const,
      confidence: 72,
      targetPrice: '$195.00',
      reason: 'Stable performance with upcoming product launches expected to drive growth.',
    },
    {
      symbol: 'TSLA',
      company: 'Tesla Inc.',
      action: 'Sell' as const,
      confidence: 65,
      targetPrice: '$215.00',
      reason: 'Increased competition in EV market and production challenges warrant caution.',
    },
  ],
  trends: [
    {
      title: 'AI Revolution Continues',
      description: 'Artificial intelligence investments are driving unprecedented growth in tech sector valuations.',
      impact: 'High' as const,
      affectedStocks: ['NVDA', 'MSFT', 'GOOGL', 'META'],
    },
    {
      title: 'Cloud Computing Expansion',
      description: 'Enterprise cloud adoption accelerating as businesses prioritize digital transformation.',
      impact: 'Medium' as const,
      affectedStocks: ['AMZN', 'MSFT', 'GOOGL'],
    },
    {
      title: 'Streaming Wars Intensify',
      description: 'Increased competition in streaming services leading to pricing pressures.',
      impact: 'Medium' as const,
      affectedStocks: ['NFLX', 'DIS', 'PARA'],
    },
  ],
  risks: [
    {
      title: 'Market Volatility Ahead',
      description: 'Economic uncertainty and geopolitical tensions may increase market volatility in coming weeks.',
      severity: 'Medium' as const,
      recommendation: 'Consider hedging strategies and maintaining cash reserves.',
    },
    {
      title: 'Tech Sector Overvaluation',
      description: 'Several tech stocks trading at historically high P/E ratios, suggesting potential correction.',
      severity: 'High' as const,
      recommendation: 'Review tech holdings and consider profit-taking on overextended positions.',
    },
    {
      title: 'Interest Rate Sensitivity',
      description: 'Growth stocks remain vulnerable to interest rate changes and Fed policy shifts.',
      severity: 'Medium' as const,
      recommendation: 'Diversify into value stocks and sectors less sensitive to rate changes.',
    },
  ],
};
