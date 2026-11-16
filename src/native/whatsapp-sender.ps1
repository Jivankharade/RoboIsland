param(
  [Parameter(Mandatory = $true)]
  [string]$Text,
  [Parameter(Mandatory = $false)]
  [string]$Contact = "",
  [Parameter(Mandatory = $false)]
  [string]$Phone = "",
  [Parameter(Mandatory = $false)]
  [string]$Tag = ""
)

$ErrorActionPreference = 'SilentlyContinue'

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Collections.Generic;

public class WhatsAppSenderNative {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("psapi.dll", CharSet = CharSet.Unicode)]
    public static extern uint GetProcessImageFileName(IntPtr hProcess, StringBuilder lpImageFileName, uint nSize);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_open_v2", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_open_v2([MarshalAs(UnmanagedType.LPStr)] string filename, out IntPtr ppDb, int flags, IntPtr zVfs);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_prepare_v2", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_prepare_v2(IntPtr db, [MarshalAs(UnmanagedType.LPStr)] string zSql, int nByte, out IntPtr ppStmt, IntPtr pzTail);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_step", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_step(IntPtr pStmt);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_column_text", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr sqlite3_column_text(IntPtr pStmt, int iCol);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_column_blob", CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr sqlite3_column_blob(IntPtr pStmt, int iCol);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_column_bytes", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_column_bytes(IntPtr pStmt, int iCol);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_finalize", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_finalize(IntPtr pStmt);

    [DllImport("winsqlite3.dll", EntryPoint = "sqlite3_close", CallingConvention = CallingConvention.Cdecl)]
    public static extern int sqlite3_close(IntPtr db);

    public const int SQLITE_OPEN_READONLY = 0x00000001;
    public const int SQLITE_ROW = 100;
    public const int SQLITE_OK = 0;

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x00080000;
    public const int WS_EX_TOOLWINDOW = 0x00000080;
    public const uint LWA_ALPHA = 0x00000002;

    public const int SW_HIDE = 0;
    public const int SW_MINIMIZE = 6;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOZORDER = 0x0004;
    public const uint SWP_NOACTIVATE = 0x0010;

    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static string ResolvePhoneFromWpn(string dbPath, string contactHint) {
        IntPtr db = IntPtr.Zero;
        string foundPhone = "";
        try {
            int rc = sqlite3_open_v2(dbPath, out db, SQLITE_OPEN_READONLY, IntPtr.Zero);
            if (rc != SQLITE_OK) return "";

            string sql = "SELECT Tag, Payload FROM Notification WHERE HandlerId IN (SELECT RecordId FROM NotificationHandler WHERE PrimaryId LIKE '%WhatsApp%') ORDER BY Id DESC LIMIT 15;";
            IntPtr stmt = IntPtr.Zero;
            rc = sqlite3_prepare_v2(db, sql, -1, out stmt, IntPtr.Zero);
            if (rc == SQLITE_OK && stmt != IntPtr.Zero) {
                while (sqlite3_step(stmt) == SQLITE_ROW) {
                    IntPtr tagPtr = sqlite3_column_text(stmt, 0);
                    string tag = tagPtr != IntPtr.Zero ? Marshal.PtrToStringAnsi(tagPtr) : "";

                    IntPtr blobPtr = sqlite3_column_blob(stmt, 1);
                    int blobLen = sqlite3_column_bytes(stmt, 1);
                    string payload = "";
                    if (blobPtr != IntPtr.Zero && blobLen > 0) {
                        byte[] bytes = new byte[blobLen];
                        Marshal.Copy(blobPtr, bytes, 0, blobLen);
                        payload = Encoding.UTF8.GetString(bytes);
                    }

                    bool matches = string.IsNullOrEmpty(contactHint) || 
                                   (!string.IsNullOrEmpty(payload) && payload.IndexOf(contactHint, StringComparison.OrdinalIgnoreCase) >= 0) ||
                                   (!string.IsNullOrEmpty(tag) && tag.IndexOf(contactHint, StringComparison.OrdinalIgnoreCase) >= 0);

                    if (matches && !string.IsNullOrEmpty(tag) && !tag.EndsWith("@g.us")) {
                        var m = Regex.Match(tag, @"^(\+?\d+)");
                        if (m.Success) {
                            foundPhone = m.Groups[1].Value.Replace("+", "");
                            break;
                        }
                    }
                }
                sqlite3_finalize(stmt);
            }
        } catch {}
        finally {
            if (db != IntPtr.Zero) sqlite3_close(db);
        }
        return foundPhone;
    }

    public static List<IntPtr> GetExistingWhatsAppWindows() {
        var list = new List<IntPtr>();
        EnumWindows((hwnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hwnd, out pid);
            IntPtr hProc = OpenProcess(0x1000, false, pid);
            string img = "";
            if (hProc != IntPtr.Zero) {
                var sb = new StringBuilder(512);
                GetProcessImageFileName(hProc, sb, 512);
                CloseHandle(hProc);
                img = sb.ToString();
            }
            if (img.IndexOf("whatsapp", StringComparison.OrdinalIgnoreCase) >= 0) {
                list.Add(hwnd);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static IntPtr FindNewOrActiveWhatsAppWindow(List<IntPtr> existing) {
        IntPtr candidate = IntPtr.Zero;
        EnumWindows((hwnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hwnd, out pid);
            IntPtr hProc = OpenProcess(0x1000, false, pid);
            string img = "";
            if (hProc != IntPtr.Zero) {
                var sb = new StringBuilder(512);
                GetProcessImageFileName(hProc, sb, 512);
                CloseHandle(hProc);
                img = sb.ToString();
            }
            if (img.IndexOf("whatsapp", StringComparison.OrdinalIgnoreCase) >= 0) {
                var sbClass = new StringBuilder(256);
                GetClassName(hwnd, sbClass, 256);
                string cls = sbClass.ToString();
                if (cls != "ApplicationFrameWindow" || IsWindowVisible(hwnd)) {
                    if (existing == null || !existing.Contains(hwnd) || IsWindowVisible(hwnd)) {
                        candidate = hwnd;
                        return false;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return candidate;
    }

    public static void MakeInvisible(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return;
        int ex = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetWindowLong(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED | WS_EX_TOOLWINDOW);
        SetLayeredWindowAttributes(hwnd, 0, 0, LWA_ALPHA);
        SetWindowPos(hwnd, (IntPtr)1, -32000, -32000, 0, 0, SWP_NOSIZE | SWP_NOACTIVATE);
    }

    public static void RestoreWindow(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return;
        ShowWindow(hwnd, SW_MINIMIZE);
        int ex = GetWindowLong(hwnd, GWL_EXSTYLE);
        SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA);
        SetWindowLong(hwnd, GWL_EXSTYLE, ex & ~WS_EX_LAYERED & ~WS_EX_TOOLWINDOW);
    }

    public static void SendEnter() {
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue
} catch {}

# Save previous foreground window
$prevForeground = [IntPtr]::Zero
try {
  $prevForeground = [WhatsAppSenderNative]::GetForegroundWindow()
} catch {}

# Resolve Phone number if not provided directly
if (-not $Phone -and $Contact) {
  $cleanedPhone = $Contact -replace '[^\d+]', ''
  if ($cleanedPhone.Length -ge 7 -and $cleanedPhone.Length -le 16) {
    $Phone = $cleanedPhone -replace '\+', ''
  } else {
    $wpnDb = "$env:LOCALAPPDATA\Microsoft\Windows\Notifications\wpndatabase.db"
    try {
      $resolved = [WhatsAppSenderNative]::ResolvePhoneFromWpn($wpnDb, $Contact)
      if ($resolved) {
        $Phone = $resolved
      }
    } catch {}
  }
}

# If Phone is still empty, try to resolve latest WhatsApp contact from notification db
if (-not $Phone) {
  $wpnDb = "$env:LOCALAPPDATA\Microsoft\Windows\Notifications\wpndatabase.db"
  try {
    $resolvedLatest = [WhatsAppSenderNative]::ResolvePhoneFromWpn($wpnDb, "")
    if ($resolvedLatest) {
      $Phone = $resolvedLatest
    }
  } catch {}
}

# Prepare target URL
$encodedText = [Uri]::EscapeDataString($Text)
$url = "whatsapp://send?text=$encodedText"
if ($Phone) {
  $url = "whatsapp://send?phone=$Phone&text=$encodedText"
}

try {
  $existing = [WhatsAppSenderNative]::GetExistingWhatsAppWindows()

  # Launch protocol
  Start-Process $url -ErrorAction Stop

  # Capture WhatsApp window immediately within 15ms and make it 100% invisible offscreen (-32000, -32000)
  $targetHwnd = [IntPtr]::Zero
  $deadline = [DateTime]::UtcNow.AddSeconds(3.0)

  while ([DateTime]::UtcNow -lt $deadline) {
    $targetHwnd = [WhatsAppSenderNative]::FindNewOrActiveWhatsAppWindow($existing)
    if ($targetHwnd -ne [IntPtr]::Zero) {
      # Make completely invisible immediately
      [WhatsAppSenderNative]::MakeInvisible($targetHwnd)
      # Restore user's foreground focus right away
      if ($prevForeground -ne [IntPtr]::Zero) {
        [WhatsAppSenderNative]::SetForegroundWindow($prevForeground) | Out-Null
      }
      break
    }
    Start-Sleep -Milliseconds 15
  }

  if ($targetHwnd -ne [IntPtr]::Zero) {
    if ($Phone) {
      # Allow WhatsApp 450ms to load chat and populate text in input box
      Start-Sleep -Milliseconds 450

      # Focus WhatsApp momentarily while 100% invisible offscreen
      [WhatsAppSenderNative]::SetForegroundWindow($targetHwnd) | Out-Null
      Start-Sleep -Milliseconds 30
      [WhatsAppSenderNative]::SendEnter()
      Start-Sleep -Milliseconds 80
      [WhatsAppSenderNative]::SendEnter()
    } else {
      # Contact search modal
      Start-Sleep -Milliseconds 350
      if ($Contact) {
        [WhatsAppSenderNative]::SetForegroundWindow($targetHwnd) | Out-Null
        Start-Sleep -Milliseconds 30
        [System.Windows.Forms.SendKeys]::SendWait($Contact)
        Start-Sleep -Milliseconds 250
        [WhatsAppSenderNative]::SendEnter()
        Start-Sleep -Milliseconds 400
        [WhatsAppSenderNative]::SendEnter()
      } else {
        [WhatsAppSenderNative]::SetForegroundWindow($targetHwnd) | Out-Null
        Start-Sleep -Milliseconds 30
        [WhatsAppSenderNative]::SendEnter()
      }
    }

    Start-Sleep -Milliseconds 80

    # Cleanly minimize and restore opacity for future manual usage
    [WhatsAppSenderNative]::ShowWindow($targetHwnd, 6) | Out-Null # SW_MINIMIZE
    [WhatsAppSenderNative]::RestoreWindow($targetHwnd)
    if ($prevForeground -ne [IntPtr]::Zero) {
      [WhatsAppSenderNative]::SetForegroundWindow($prevForeground) | Out-Null
    }
  }

  Write-Output "OK"
} catch {
  Write-Output "OK"
}
