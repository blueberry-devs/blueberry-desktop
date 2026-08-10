$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\rytp8\coding\music\resources\icon-transparent.png'
$resDir = 'C:\Users\rytp8\coding\music\src-tauri\gen\android\app\src\main\res'

if (-not (Test-Path $sourcePath)) { throw "Source logo not found: $sourcePath" }

$src = [System.Drawing.Image]::FromFile($sourcePath)
$srcBmp = New-Object System.Drawing.Bitmap($src)
$srcW = $srcBmp.Width
$srcH = $srcBmp.Height

# --- Alpha bounding box of the logo ---------------------------------------
$minX = $srcW; $minY = $srcH; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $srcH; $y++) {
  for ($x = 0; $x -lt $srcW; $x++) {
    if ($srcBmp.GetPixel($x, $y).A -gt 8) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$srcBmp.Dispose()
if ($maxX -lt 0) { throw 'Logo has no opaque pixels' }
$logoW = $maxX - $minX + 1
$logoH = $maxY - $minY + 1
Write-Host "Logo bounding box: $logoW x $logoH at ($minX,$minY)"

# --- Draw helper ------------------------------------------------------------
function Draw-Logo {
  param(
    [int]$Canvas,
    [double]$ContentScale,
    [bool]$Monochrome,
    [bool]$CircleMask,
    [bool]$BackgroundGradient
  )
  $bmp = New-Object System.Drawing.Bitmap($Canvas, $Canvas, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($BackgroundGradient) {
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Canvas, $Canvas)
    $top = [System.Drawing.ColorTranslator]::FromHtml('#7C92EE')
    $bottom = [System.Drawing.ColorTranslator]::FromHtml('#465FC9')
    $mode = [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $top, $bottom, $mode)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
  }

  $base = [Math]::Max($logoW, $logoH)
  $drawW = [Math]::Round($logoW * ($Canvas * $ContentScale) / $base)
  $drawH = [Math]::Round($logoH * ($Canvas * $ContentScale) / $base)
  $dx = [int](($Canvas - $drawW) / 2)
  $dy = [int](($Canvas - $drawH) / 2)
  $dest = New-Object System.Drawing.Rectangle($dx, $dy, $drawW, $drawH)
  $srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $logoW, $logoH)

  if ($Monochrome) {
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $cm = New-Object System.Drawing.Imaging.ColorMatrix
    $cm.Matrix00 = 0; $cm.Matrix01 = 0; $cm.Matrix02 = 0
    $cm.Matrix10 = 0; $cm.Matrix11 = 0; $cm.Matrix12 = 0
    $cm.Matrix20 = 0; $cm.Matrix21 = 0; $cm.Matrix22 = 0
    $cm.Matrix30 = 0; $cm.Matrix31 = 0; $cm.Matrix32 = 0
    $cm.Matrix33 = 1; $cm.Matrix44 = 1
    $attr.SetColorMatrix($cm)
    $unit = [System.Drawing.GraphicsUnit]::Pixel
    $g.DrawImage($src, $dest, $minX, $minY, $logoW, $logoH, $unit, $attr)
    $attr.Dispose()
  } else {
    $g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  }

  if ($CircleMask) {
    $mask = New-Object System.Drawing.Drawing2D.GraphicsPath
    $mask.AddEllipse(0, 0, $Canvas - 1, $Canvas - 1)
    $g.SetClip($mask, [System.Drawing.Drawing2D.CombineMode]::Intersect)
  }

  $g.Dispose()
  return $bmp
}

function Save-Png {
  param($Bmp, [string]$Path)
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
  $Bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $stream.Close()
  $Bmp.Dispose()
  Write-Host "  wrote $Path"
}

# --- Density table ----------------------------------------------------------
$densities = @(
  @{ Name = 'mdpi';    Foreground = 108; Legacy = 48 },
  @{ Name = 'hdpi';    Foreground = 162; Legacy = 72 },
  @{ Name = 'xhdpi';   Foreground = 216; Legacy = 96 },
  @{ Name = 'xxhdpi';  Foreground = 324; Legacy = 144 },
  @{ Name = 'xxxhdpi'; Foreground = 432; Legacy = 192 }
)

foreach ($d in $densities) {
  $mipmap = Join-Path $resDir "mipmap-$($d.Name)"
  Write-Host "== $($d.Name) =="
  $fg = Draw-Logo -Canvas $d.Foreground -ContentScale 0.58 -Monochrome $false
  Save-Png $fg (Join-Path $mipmap 'ic_launcher_foreground.png')
  $mono = Draw-Logo -Canvas $d.Foreground -ContentScale 0.58 -Monochrome $true
  Save-Png $mono (Join-Path $mipmap 'ic_launcher_monochrome.png')
  $legacy = Draw-Logo -Canvas $d.Legacy -ContentScale 0.62 -Monochrome $false -BackgroundGradient $true
  Save-Png $legacy (Join-Path $mipmap 'ic_launcher.png')
  $round = Draw-Logo -Canvas $d.Legacy -ContentScale 0.62 -Monochrome $false -BackgroundGradient $true -CircleMask $true
  Save-Png $round (Join-Path $mipmap 'ic_launcher_round.png')
}

$src.Dispose()
Write-Host 'Done.'
