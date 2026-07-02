namespace CryptoPulse.Models;

public class PriceTick
{
    public string   Symbol    { get; set; } = string.Empty;
    public DateTime Time      { get; set; }
    public decimal  Price     { get; set; }
    public decimal  Change    { get; set; }
    public decimal  ChangePercent { get; set; }
    public bool     IsAnomaly { get; set; }
    public string   AnomalyReason { get; set; } = string.Empty;
    public decimal  High24h   { get; set; }
    public decimal  Low24h    { get; set; }
    public long     Volume    { get; set; }
}
