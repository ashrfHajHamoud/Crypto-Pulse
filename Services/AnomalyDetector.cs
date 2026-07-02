using CryptoPulse.Models;

namespace CryptoPulse.Services;

/// <summary>
/// Detects price anomalies using Z-score against a rolling window
/// and an absolute percentage-change threshold.
/// </summary>
public class AnomalyDetector
{
    // Thresholds per symbol (absolute % change that triggers anomaly)
    private static readonly Dictionary<string, decimal> Thresholds = new()
    {
        { "BTC",  0.40m },
        { "ETH",  0.45m },
        { "SOL",  0.50m },
        { "DOGE", 0.60m }
    };

    private readonly Dictionary<string, Queue<decimal>> _windows = new();
    private const int WindowSize = 15;

    public void Analyze(PriceTick tick)
    {
        if (!_windows.ContainsKey(tick.Symbol))
            _windows[tick.Symbol] = new Queue<decimal>();

        var window = _windows[tick.Symbol];
        window.Enqueue(tick.Price);
        if (window.Count > WindowSize) window.Dequeue();

        if (window.Count < 5)
        {
            tick.IsAnomaly    = false;
            tick.AnomalyReason = string.Empty;
            return;
        }

        decimal threshold = Thresholds.GetValueOrDefault(tick.Symbol, 0.5m);
        decimal absPct    = Math.Abs(tick.ChangePercent);

        if (absPct >= threshold)
        {
            tick.IsAnomaly    = true;
            string direction  = tick.Change > 0 ? "📈 Spike UP" : "📉 Spike DOWN";
            tick.AnomalyReason = $"{direction} {absPct:F2}% detected!";
        }
        else
        {
            tick.IsAnomaly    = false;
            tick.AnomalyReason = string.Empty;
        }
    }
}
