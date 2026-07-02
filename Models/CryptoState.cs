namespace CryptoPulse.Models;

public class CryptoState
{
    public string  Symbol        { get; set; } = string.Empty;
    public decimal CurrentPrice  { get; set; }
    public decimal High24h       { get; set; }
    public decimal Low24h        { get; set; }
    public decimal PreviousPrice { get; set; }
    public long    Volume        { get; set; }
    public List<decimal> RecentPrices { get; set; } = new();
}
