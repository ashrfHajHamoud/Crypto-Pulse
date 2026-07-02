# CryptoPulse – Real-Time Crypto Price Streaming Dashboard

**Course:** Advanced Web Development – Streaming  
**Student:** Ashraf Haj Hamoud  -- Ahmed Omar Abbas

**University:** International University of Sciences and Renaissance – Faculty of IT Engineering

---

## Demo Video

> 📹Ashraf Haj Hamoud **[https://youtu.be/YOUR-VIDEO-LINK](https://youtu.be/nH4wg1Xb5k0)**
> > 📹Ahmed Omar Abbas **https://youtu.be/FyTelTHIrQg**

---

## Streaming Details

| Property | Value |
|---|---|
| **Technique** | `IAsyncEnumerable<PriceTick>` JSON Streaming (NDJSON) |
| **Endpoint** | `GET /Stream/Prices?symbol=BTC` (single) · `GET /Stream/AllPrices` (all coins) |
| **What is streamed** | Live cryptocurrency price ticks – price, change %, 24h high/low, volume |
| **Smart Idea** | **Real-Time Anomaly Detection** – Z-score + threshold analysis flags abnormal price spikes per symbol, shown as ⚠ alerts with flash effects |
| **Reconnect** | Auto-reconnect after 3 s on connection loss with overlay countdown |
| **Multi-coin** | BTC · ETH · SOL · DOGE switchable live; All-Coins table mode |

---

## Features

-  Continuous NDJSON stream via `IAsyncEnumerable` – no polling, no SSE, no WebSocket
-  Live Chart.js price chart (last 60 ticks, no page reload)
-  Real-time stat cards: current price, 24h high/low, volume
-  Event log with timestamp, symbol, price, % change
-  **Anomaly detection**: per-symbol thresholds + rolling-window, flash alert on spike
-  All-Coins live table (BTC + ETH + SOL + DOGE simultaneously)
-  Auto-reconnect with overlay (kill the server → reconnect shown → restart → resumes)
-  Dark / Light theme toggle
-  Clean connection abort on symbol/mode switch

---

## How to Run

```bash
# Requires .NET 8 SDK
git clone https://github.com/YOUR-USER/CryptoPulse.git
cd CryptoPulse
dotnet restore
dotnet run
# Then open: https://localhost:52773
```

---

## Project Structure

```
CryptoPulse/
├── Controllers/
│   ├── HomeController.cs       # Serves the dashboard page
│   └── StreamController.cs     # IAsyncEnumerable NDJSON endpoints
├── Models/
│   ├── PriceTick.cs            # Streamed data model
│   └── CryptoState.cs          # Per-symbol state (price history, hi/lo)
├── Services/
│   ├── CryptoPriceGenerator.cs # Simulates realistic price movements
│   └── AnomalyDetector.cs      # Rolling-window spike detection
├── Views/
│   ├── Home/Index.cshtml       # Dashboard Razor page
│   └── Shared/_Layout.cshtml   # Navbar + layout
├── wwwroot/
│   ├── js/stream.js            # Fetch + ReadableStream NDJSON client
│   └── css/site.css            # Dark/light theme styles
└── Program.cs                  # DI + routing setup
```

---

## Grading Coverage

| Criterion | Implementation |
|---|---|
| Streaming channel (40%) | `IAsyncEnumerable` NDJSON – continuous, never one-shot |
| Live browser UI (25%) | `fetch` + `ReadableStream` – chart + cards update without reload |
| Reconnect / robustness (10%) | Auto-reconnect after 3 s, clean abort via `AbortController` |
| Code quality / Git (10%) | Separated Controllers / Models / Services, clean commits |
| Demo video + GitHub (15%) | See link above |
| Smart idea – bonus (15%) | Anomaly detection with rolling window + flash alert |
