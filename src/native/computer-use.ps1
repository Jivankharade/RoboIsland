param(
  [Parameter(Mandatory = $true)]
  [string]$Action, # "click", "double_click", "move", "drag", "type", "key"
  [Parameter(Mandatory = $false)]
  [int]$X = 0,
  [Parameter(Mandatory = $false)]
  [int]$Y = 0,
  [Parameter(Mandatory = $false)]
  [int]$EndX = 0,
  [Parameter(Mandatory = $false)]
  [int]$EndY = 0,
  [Parameter(Mandatory = $false)]
  [string]$Text = "",
  [Parameter(Mandatory = $false)]
  [string]$Key = ""
)

$ErrorActionPreference = 'SilentlyContinue'

Add-Type -AssemblyName System.Windows.Forms

try {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class OSController {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN= 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP  = 0x0010;

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(60);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void DoubleClick(int x, int y) {
        Click(x, y);
        Thread.Sleep(90);
        Click(x, y);
    }

    public static void MoveSmooth(int startX, int startY, int endX, int endY, int steps) {
        for (int i = 1; i <= steps; i++) {
            int curX = startX + (endX - startX) * i / steps;
            int curY = startY + (endY - startY) * i / steps;
            SetCursorPos(curX, curY);
            Thread.Sleep(8);
        }
    }

    public static void Drag(int startX, int startY, int endX, int endY) {
        SetCursorPos(startX, startY);
        Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(100);
        MoveSmooth(startX, startY, endX, endY, 20);
        Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue
} catch {}

switch ($Action.ToLower()) {
  "click" {
    [OSController]::Click($X, $Y)
    if ($Text) {
      Start-Sleep -Milliseconds 250
      Set-Clipboard -Value $Text
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    }
    if ($Key) {
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait($Key)
    }
  }

  "double_click" {
    [OSController]::DoubleClick($X, $Y)
  }

  "move" {
    [void][OSController]::SetCursorPos($X, $Y)
  }

  "drag" {
    [OSController]::Drag($X, $Y, $EndX, $EndY)
  }

  "type" {
    if ($Text) {
      Set-Clipboard -Value $Text
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    }
    if ($Key) {
      Start-Sleep -Milliseconds 100
      [System.Windows.Forms.SendKeys]::SendWait($Key)
    }
  }

  "key" {
    if ($Key) {
      [System.Windows.Forms.SendKeys]::SendWait($Key)
    }
  }
}

Write-Output "OK"
