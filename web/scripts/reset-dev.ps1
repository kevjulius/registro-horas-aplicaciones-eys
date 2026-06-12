$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $root.Path

$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId -and $processId -ne $PID) {
    Stop-Process -Id $processId -Force
  }
}

$escapedRoot = [regex]::Escape($root.Path)
$relatedProcesses = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $PID -and
    $_.CommandLine -and
    $_.CommandLine -match $escapedRoot -and
    ($_.Name -in @("node.exe", "npm.cmd", "cmd.exe", "powershell.exe"))
  }

foreach ($process in $relatedProcesses) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

$nextPath = Join-Path $root.Path ".next"
if (Test-Path -LiteralPath $nextPath) {
  $resolvedNext = Resolve-Path -LiteralPath $nextPath
  if ($resolvedNext.Path.StartsWith($root.Path)) {
    for ($attempt = 1; $attempt -le 5; $attempt++) {
      try {
        Remove-Item -LiteralPath $resolvedNext.Path -Recurse -Force -ErrorAction Stop
        break
      } catch {
        if ($attempt -eq 5) {
          throw
        }
        Start-Sleep -Seconds 1
      }
    }
  }
}

Start-Process -FilePath npm.cmd -ArgumentList "run", "dev" -WorkingDirectory $root.Path -WindowStyle Hidden
Start-Sleep -Seconds 4

try {
  $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
  Write-Host "Servidor reiniciado en http://localhost:3000 - Status $($response.StatusCode)"
} catch {
  Write-Host "Servidor iniciado, pero aun no responde. Espera unos segundos y recarga."
}
