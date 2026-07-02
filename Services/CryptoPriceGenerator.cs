using CryptoPulse.Models;

namespace CryptoPulse.Services;

public class CryptoPriceGenerator
{
    private readonly Dictionary<string, CryptoState> _states;
    private readonly Random _rnd = new();

    private static readonly Dictionary<string, decimal> InitialPrices = new()
    {
        { "BTC",  50000m },
        { "ETH",   3000m },
        { "SOL",    150m },
        { "DOGE",     0.12m }
    };

    public CryptoPriceGenerator()
    {
        _states = InitialPrices.ToDictionary(
            kvp => kvp.Key,
            kvp => new CryptoState
            {
                Symbol        = kvp.Key,
                CurrentPrice  = kvp.Value,
                PreviousPrice = kvp.Value,
                High24h       = kvp.Value * 1.02m,
                Low24h        = kvp.Value * 0.98m,
                Volume        = _rnd.NextInt64(1_000_000, 50_000_000)
            });
    }

    public PriceTick Generate(string symbol)
    {
        if (!_states.TryGetValue(symbol, out var state))
            throw new ArgumentException($"Unknown symbol: {symbol}");

        // Simulate realistic price movement with occasional spikes
        double volatility = symbol switch
        {
            "BTC"  => 200.0,
            "ETH"  => 30.0,
            "SOL"  => 2.0,
            "DOGE" => 0.003,
            _      => 1.0
        };

        // 5% chance of a large spike (anomaly)
        bool forcedSpike = _rnd.NextDouble() < 0.05;
        double multiplier = forcedSpike ? 4.0 : 1.0;

        decimal delta = (decimal)((_rnd.NextDouble() * 2 - 1) * volatility * multiplier);

        state.PreviousPrice = state.CurrentPrice;
        state.CurrentPrice  = Math.Max(state.CurrentPrice + delta, 0.0001m);

        if (state.CurrentPrice > state.High24h) state.High24h = state.CurrentPrice;
        if (state.CurrentPrice < state.Low24h)  state.Low24h  = state.CurrentPrice;

        state.Volume += _rnd.NextInt64(1_000, 100_000);

        // Keep rolling window for anomaly detection
        state.RecentPrices.Add(state.CurrentPrice);
        if (state.RecentPrices.Count > 20)
            state.RecentPrices.RemoveAt(0);

        decimal changePercent = state.PreviousPrice == 0
            ? 0
            : (delta / state.PreviousPrice) * 100m;

        return new PriceTick
        {
            Symbol        = symbol,
            Time          = DateTime.UtcNow,
            Price         = Math.Round(state.CurrentPrice, 4),
            Change        = Math.Round(delta, 4),
            ChangePercent = Math.Round(changePercent, 2),
            High24h       = Math.Round(state.High24h, 4),
            Low24h        = Math.Round(state.Low24h, 4),
            Volume        = state.Volume
        };
    }

    public IReadOnlyList<string> Symbols => _states.Keys.ToList();
}
