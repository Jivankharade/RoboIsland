param(
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 400,
  [int]$Height = 300
)

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

# Win32 user32 imports for Window under cursor
$sig = @'
[DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(System.Drawing.Point p);
[DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
'@
$User32 = Add-Type -MemberDefinition $sig -Name "Win32Buddy" -Namespace "RoboBuddy" -PassThru

# Identify window
$pt = New-Object System.Drawing.Point($X, $Y)
$hwnd = [RoboBuddy.Win32Buddy]::WindowFromPoint($pt)
# Get root window
$rootHwnd = [RoboBuddy.Win32Buddy]::GetAncestor($hwnd, 2)
if ($rootHwnd -ne [IntPtr]::Zero) { $hwnd = $rootHwnd }

$sb = New-Object System.Text.StringBuilder(256)
[void][RoboBuddy.Win32Buddy]::GetWindowText($hwnd, $sb, 256)
$winTitle = $sb.ToString()

$pid = 0
[void][RoboBuddy.Win32Buddy]::GetWindowThreadProcessId($hwnd, [ref]$pid)
$procName = ""
if ($pid -gt 0) {
  try {
    $procName = (Get-Process -Id $pid).ProcessName
  } catch {}
}

# Capture localized rectangle
$left = [Math]::Max(0, $X - [Math]::Round($Width / 2))
$top = [Math]::Max(0, $Y - [Math]::Round($Height / 2))

$bmp = New-Object System.Drawing.Bitmap($Width, $Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($left, $top, 0, 0, (New-Object System.Drawing.Size($Width, $Height)), [System.Drawing.CopyPixelOperation]::SourceCopy)

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$base64 = [Convert]::ToBase64String($ms.ToArray())

$g.Dispose()
$bmp.Dispose()
$ms.Dispose()

$result = @{
  title = $winTitle
  process = $procName
  x = $X
  y = $Y
  image = $base64
}

$result | ConvertTo-Json -Compress
