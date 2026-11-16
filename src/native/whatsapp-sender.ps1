param(
  [Parameter(Mandatory = $true)]
  [string]$Text,
  [Parameter(Mandatory = $false)]
  [string]$Contact = ""
)

$ErrorActionPreference = 'SilentlyContinue'

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class WhatsAppSenderNative {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public const int SW_HIDE = 0;
    public const int SW_SHOWMINNOACTIVE = 7;
    public const int SW_MINIMIZE = 6;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOZORDER = 0x0004;
    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void SendEnter() {
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(60);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue
} catch {}

$prevForeground = [IntPtr]::Zero
try {
  $prevForeground = [WhatsAppSenderNative]::GetForegroundWindow()
} catch {}

# Prepare target URL
$encodedText = [Uri]::EscapeDataString($Text)
$url = "whatsapp://send?text=$encodedText"

if ($Contact) {
  # If contact contains a valid international or local phone number
  $cleanedPhone = $Contact -replace '[^\d+]', ''
  if ($cleanedPhone.Length -ge 7 -and $cleanedPhone.Length -le 16) {
    $url = "whatsapp://send?phone=$cleanedPhone&text=$encodedText"
  }
}

try {
  # Launch WhatsApp protocol
  Start-Process $url -ErrorAction Stop

  # Wait for WhatsApp window to appear and capture it offscreen
  $targetHwnd = [IntPtr]::Zero
  $deadline = [DateTime]::UtcNow.AddSeconds(2.5)

  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 60
    $script:foundHwnd = [IntPtr]::Zero

    [WhatsAppSenderNative]::EnumWindows({
      param($hwnd, $lParam)
      $pidOut = 0
      [WhatsAppSenderNative]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
      $p = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
      if ($p -and ($p.ProcessName -match 'whatsapp' -or $p.MainWindowTitle -match 'whatsapp')) {
        $sbClass = New-Object System.Text.StringBuilder 128
        [WhatsAppSenderNative]::GetClassName($hwnd, $sbClass, 128)
        $cls = $sbClass.ToString()
        # Ensure it is a top-level application window
        if ($cls -ne "Windows.UI.Core.CoreWindow" -or [WhatsAppSenderNative]::IsWindowVisible($hwnd)) {
          $script:foundHwnd = $hwnd
          return $false
        }
      }
      return $true
    }, [IntPtr]::Zero)

    if ($script:foundHwnd -ne [IntPtr]::Zero) {
      $targetHwnd = $script:foundHwnd
      break
    }
  }

  if ($targetHwnd -ne [IntPtr]::Zero) {
    # Move window offscreen immediately so it never interrupts the user's view
    [WhatsAppSenderNative]::SetWindowPos($targetHwnd, [IntPtr]::Zero, -32000, -32000, 0, 0, 0x0001 -bor 0x0004)

    # Allow WhatsApp a moment to register the incoming protocol text
    Start-Sleep -Milliseconds 180

    # Direct send: trigger Enter keystroke
    [WhatsAppSenderNative]::SendEnter()

    Start-Sleep -Milliseconds 120

    # Immediately minimize / hide WhatsApp to keep workspace clean
    [WhatsAppSenderNative]::ShowWindow($targetHwnd, 6) # SW_MINIMIZE

    # Restore focus to previous application
    if ($prevForeground -ne [IntPtr]::Zero) {
      [WhatsAppSenderNative]::SetForegroundWindow($prevForeground)
    }
  }

  Write-Output "OK"
} catch {
  Write-Output "FALLBACK"
}
