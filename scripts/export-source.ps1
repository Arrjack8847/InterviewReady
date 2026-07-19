param(
  [string]$OutputPath = "InterviewReady-source.zip"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$destination = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputPath))
$worktreeChanges = @(git -C $repositoryRoot status --porcelain)
if ($worktreeChanges.Count -gt 0) {
  throw "Archive stopped because the worktree is not clean. Commit reviewed source changes before exporting HEAD."
}
$trackedFiles = @(git -C $repositoryRoot ls-files)

$blockedPatterns = @(
  '(^|/)\.env($|\.)',
  '(^|/)\.vercel/',
  '(^|/)(dist|build|node_modules)/',
  '\.log$'
)
$unsafeTrackedFiles = @(
  $trackedFiles | Where-Object {
    $path = $_
    $isSafeExample = $path -match '(^|/)\.env\.example$'
    -not $isSafeExample -and ($blockedPatterns | Where-Object { $path -match $_ })
  }
)

if ($unsafeTrackedFiles.Count -gt 0) {
  throw "Archive stopped because Git tracks a sensitive or generated path. Remove it from tracking before exporting."
}

if (Test-Path -LiteralPath $destination) {
  Remove-Item -LiteralPath $destination -Force
}

git -C $repositoryRoot archive --format=zip --output=$destination HEAD
if ($LASTEXITCODE -ne 0) {
  throw "Git could not create the source archive."
}

Write-Output "Created a committed-source archive at $destination"
