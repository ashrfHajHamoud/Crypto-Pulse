using Microsoft.AspNetCore.Mvc;

namespace CryptoPulse.Controllers;

public class HomeController : Controller
{
    public IActionResult Index() => View();
}
