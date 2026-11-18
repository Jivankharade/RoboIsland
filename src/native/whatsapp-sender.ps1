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
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# ─── Load Win32 helpers ──────────────────────────────────────────────────────
Add-Type -TypeDefinition @'
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
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWndProc f, IntPtr l);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder b, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);

    public const byte VK_RETURN = 0x0D;
    public const byte VK_DOWN   = 0x28;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public delegate bool EnumWndProc(IntPtr h, IntPtr l);

    public static void SendEnter() {
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(50);
    }

    public static void PressKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(60);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(60);
    }

    public static IntPtr FindWindowByTitleSubstr(string substr) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, 512);
            if (sb.ToString().IndexOf(substr, StringComparison.OrdinalIgnoreCase) >= 0) {
                found = h;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            if (!IsWindowVisible(h)) return true;
            uint wpid = 0;
            GetWindowThreadProcessId(h, out wpid);
            if (wpid == pid) { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
'@ -ErrorAction SilentlyContinue

$prevForeground = [IntPtr]::Zero
try {
  $prevForeground = [WhatsAppSenderNative]::GetForegroundWindow()
} catch {}

# ─── Autonomous Mode (Full UI Automation & Keystrokes) ───────────────────────
if ($Autonomous -or ($Contact -and -not $Phone)) {
  # 1. Bring WhatsApp to front via protocol activation
  Start-Process "whatsapp://"
  Start-Sleep -Milliseconds 650

  $wshell = New-Object -ComObject WScript.Shell
  $wshell.AppActivate("WhatsApp") | Out-Null
  Start-Sleep -Milliseconds 250

  $wa = Get-Process -Name "WhatsApp.Root" -ErrorAction SilentlyContinue
  $hwnd = [WhatsAppSenderNative]::FindWindowByTitleSubstr("WhatsApp")
  if ($hwnd -eq [IntPtr]::Zero -and $wa) {
    $hwnd = [WhatsAppSenderNative]::FindWindowByPid([uint32]$wa.Id)
  }

  if ($hwnd -ne [IntPtr]::Zero) {
    [WhatsAppSenderNative]::ShowWindow($hwnd, 9) | Out-Null
    [WhatsAppSenderNative]::SetForegroundWindow($hwnd) | Out-Null
    Start-Sleep -Milliseconds 350
  }

  # 2. Dismiss any open modals or dialogs
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
  Start-Sleep -Milliseconds 120

  # 3. Focus WhatsApp Search Bar (Ctrl+E / Ctrl+F)
  [System.Windows.Forms.SendKeys]::SendWait("^e")
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait("^f")
  Start-Sleep -Milliseconds 300

  # 4. Clear existing search text
  [System.Windows.Forms.SendKeys]::SendWait("^a")
  Start-Sleep -Milliseconds 60
  [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
  Start-Sleep -Milliseconds 60

  # 5. Search Contact or Group
  if ($Contact) {
    Set-Clipboard -Value $Contact.Trim()
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 900

    # 6. Highlight first matching contact and press Enter to open chat
    [WhatsAppSenderNative]::PressKey([WhatsAppSenderNative]::VK_DOWN)
    Start-Sleep -Milliseconds 250
    [WhatsAppSenderNative]::SendEnter()
    Start-Sleep -Milliseconds 650
  }

  # 7. Type message or emoji into the chat
  $msg = if ($Text) { $Text.Trim() } else { "Hi" }
  Set-Clipboard -Value $msg
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 300

  # 8. Press Enter to send!
  [WhatsAppSenderNative]::SendEnter()
  Start-Sleep -Milliseconds 250

  # 9. Restore previous active window so WhatsApp does not get in user's way
  if ($prevForeground -ne [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 250
    [WhatsAppSenderNative]::SetForegroundWindow($prevForeground) | Out-Null
  }

  Write-Output "OK: Sent '$msg' to '$Contact'"
  exit 0
}

# ─── Notification Quick-Reply Mode (Background Offscreen) ────────────────────
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
exit 0
