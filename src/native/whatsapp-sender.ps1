param(
  [Parameter(Mandatory = $true)]
  [string]$Text,
  [Parameter(Mandatory = $false)]
  [string]$Contact = "",
  [Parameter(Mandatory = $false)]
  [string]$Phone = "",
  [Parameter(Mandatory = $false)]
  [string]$Tag = "",
  [Parameter(Mandatory = $false)]
  [switch]$Autonomous
)

$ErrorActionPreference = 'SilentlyContinue'

Add-Type -AssemblyName System.Windows.Forms

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Collections.Generic;

public class WhatsAppSenderNative {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void SendEnter() {
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue
} catch {}

$prevForeground = [IntPtr]::Zero
try {
  $prevForeground = [WhatsAppSenderNative]::GetForegroundWindow()
} catch {}

# Autonomous Mode (e.g. "open whats app and send hi message to pratik pdea")
if ($Autonomous -or ($Contact -and -not $Phone)) {
  # 1. Bring WhatsApp to front
  $wshell = New-Object -ComObject WScript.Shell
  $act = $wshell.AppActivate("WhatsApp")
  if (-not $act) {
    Start-Process "whatsapp://"
    Start-Sleep -Milliseconds 800
    $wshell.AppActivate("WhatsApp") | Out-Null
  } else {
    Start-Sleep -Milliseconds 300
  }

  # 2. Focus WhatsApp Search Bar (Ctrl+F)
  [System.Windows.Forms.SendKeys]::SendWait("^f")
  Start-Sleep -Milliseconds 250

  # 3. Clear existing text
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 80
  [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
  Start-Sleep -Milliseconds 80

  # 4. Type / Paste Contact name
  if ($Contact) {
    Set-Clipboard -Value $Contact.Trim()
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 800

    # 5. Highlight first matching contact and press Enter to open chat
    [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    Start-Sleep -Milliseconds 500
  }

  # 6. Type / Paste the Message into the chat input field
  $msg = if ($Text) { $Text.Trim() } else { "Hi" }
  Set-Clipboard -Value $msg
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 250

  # 7. Press Enter to send!
  [WhatsAppSenderNative]::SendEnter()

  Write-Output "OK"
  exit 0
}

# Notification Quick-Reply Mode (Background Offscreen)
$targetHwnd = [IntPtr]::Zero
# Moves window offscreen (-32000, -32000) so user never sees it open
[WhatsAppSenderNative]::SetWindowPos($targetHwnd, [IntPtr]1, -32000, -32000, 0, 0, (0x0001 -bor 0x0010)) | Out-Null

# Direct send enter
[WhatsAppSenderNative]::SendEnter()

# Minimizes WhatsApp and restores previous active window
[WhatsAppSenderNative]::ShowWindow($targetHwnd, 6) | Out-Null
if ($prevForeground -ne [IntPtr]::Zero) {
  [WhatsAppSenderNative]::SetForegroundWindow($prevForeground) | Out-Null
}

Write-Output "OK"
