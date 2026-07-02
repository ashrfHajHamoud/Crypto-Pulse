using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;
using CryptoPulse.Services;
using CryptoPulse.Models;

namespace CryptoPulse.Controllers;

public class StreamController : Controller
{
    private readonly CryptoPriceGenerator _generator;
    private readonly AnomalyDetector      _detector;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public StreamController(CryptoPriceGenerator generator, AnomalyDetector detector)
    {
        _generator = generator;
        _detector  = detector;
    }

    // ─── GET /Stream/Prices?symbol=BTC ────────────────────────────────────────
    // Streams NDJSON price ticks for a given symbol using IAsyncEnumerable.
    [HttpGet]
    public async Task Prices(string symbol = "BTC", CancellationToken cancellationToken = default)
    {
        symbol = symbol.ToUpperInvariant();

        Response.Headers.Append("Content-Type",  "application/x-ndjson");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        await foreach (var tick in GenerateTicks(symbol, cancellationToken))
        {
            string line = JsonSerializer.Serialize(tick, JsonOpts) + "\n";
            byte[] bytes = Encoding.UTF8.GetBytes(line);

            await Response.Body.WriteAsync(bytes, cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    // ─── IAsyncEnumerable ─────────────────────────────────────────────────────
    private async IAsyncEnumerable<PriceTick> GenerateTicks(
        string symbol,
        [System.Runtime.CompilerServices.EnumeratorCancellation]
        CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            PriceTick tick;
            try
            {
                tick = _generator.Generate(symbol);
                _detector.Analyze(tick);
            }
            catch
            {
                yield break;
            }

            yield return tick;

            await Task.Delay(1000, cancellationToken).ConfigureAwait(false);
        }
    }

    // ─── GET /Stream/AllPrices ────────────────────────────────────────────────
    // Streams ticks for ALL symbols round-robin (one per 500 ms).
    [HttpGet]
    public async Task AllPrices(CancellationToken cancellationToken = default)
    {
        Response.Headers.Append("Content-Type",  "application/x-ndjson");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var symbols = _generator.Symbols.ToList();
        int i       = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            string symbol = symbols[i % symbols.Count];
            i++;

            PriceTick tick;
            try
            {
                tick = _generator.Generate(symbol);
                _detector.Analyze(tick);
            }
            catch { break; }

            string line  = JsonSerializer.Serialize(tick, JsonOpts) + "\n";
            byte[] bytes = Encoding.UTF8.GetBytes(line);

            try
            {
                await Response.Body.WriteAsync(bytes, cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);
            }
            catch { break; }

            await Task.Delay(400, cancellationToken).ConfigureAwait(false);
        }
    }
}
