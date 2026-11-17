param(
  [Parameter(Mandatory = $true)]
  [string]$Action, # "type", "search", "open_and_type", "send_keys"
  [Parameter(Mandatory = $false)]
  [string]$App = "",
  [Parameter(Mandatory = $false)]
  [string]$Text = "",
  [Parameter(Mandatory = $false)]
  [string]$Keys = ""
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell

switch ($Action.ToLower()) {
  "open_and_type" {
    # 1. Launch or activate app
    if ($App) {
      $activated = $wshell.AppActivate($App)
      if (-not $activated) {
        Start-Process $App -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 1200
        $wshell.AppActivate($App) | Out-Null
      }
    }
    Start-Sleep -Milliseconds 400

    # 2. Paste or type text
    if ($Text) {
      Set-Clipboard -Value $Text
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    }

    # 3. Extra keys (e.g. Enter)
    if ($Keys) {
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait($Keys)
    }
  }

  "type" {
    # Type directly into currently focused window
    if ($Text) {
      Set-Clipboard -Value $Text
      [System.Windows.Forms.SendKeys]::SendWait("^v")
    }
    if ($Keys) {
      Start-Sleep -Milliseconds 150
      [System.Windows.Forms.SendKeys]::SendWait($Keys)
    }
  }

  "send_keys" {
    if ($Keys) {
      [System.Windows.Forms.SendKeys]::SendWait($Keys)
    }
  }

  "search" {
    # Activate app, press Ctrl+F (or Ctrl+L for browser), type text, press Enter
    if ($App) {
      $wshell.AppActivate($App) | Out-Null
    }
    Start-Sleep -Milliseconds 300
    [System.Windows.Forms.SendKeys]::SendWait("^f")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    [System.Windows.Forms.SendKeys]::SendWait("{BACKSPACE}")
    if ($Text) {
      Set-Clipboard -Value $Text
      [System.Windows.Forms.SendKeys]::SendWait("^v")
      Start-Sleep -Milliseconds 300
      [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
  }
}

Write-Output "OK"
