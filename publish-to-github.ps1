param(
    [string]$RepositoryName = "jelly-jump-web-lens",
    [ValidateSet("Private", "Public")]
    [string]$Visibility = "Private"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE."
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/ and reopen PowerShell."
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is not installed. Install Git for Windows from https://git-scm.com/download/win."
}

Invoke-Checked -Command "gh" -Arguments @("auth", "status")

$existingRemote = $null
try {
    $existingRemote = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0) { $existingRemote = $null }
} catch { $existingRemote = $null }
if ($existingRemote) {
    throw "An origin remote already exists ($existingRemote). This script stopped to avoid pushing to the wrong repository. Remove or change the remote intentionally, then rerun."
}

$isRepo = $false
& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -eq 0) { $isRepo = $true }
if (-not $isRepo) {
    Invoke-Checked -Command "git" -Arguments @("init", "-b", "main")
}
Invoke-Checked -Command "git" -Arguments @("branch", "-M", "main")

$userName = (& gh api user --jq .login).Trim()
if (-not $userName) { throw "Could not read the authenticated GitHub username. Run gh auth login and retry." }
$gitName = (& git config user.name)
if (-not $gitName) { Invoke-Checked -Command "git" -Arguments @("config", "user.name", $userName) }
$gitEmail = (& git config user.email)
if (-not $gitEmail) { Invoke-Checked -Command "git" -Arguments @("config", "user.email", "$userName@users.noreply.github.com") }

Invoke-Checked -Command "git" -Arguments @("add", "--all")
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "No staged changes found; checking whether an initial commit already exists."
    & git rev-parse HEAD *> $null
    if ($LASTEXITCODE -ne 0) { throw "No files were staged, so there is nothing to publish." }
} else {
    Invoke-Checked -Command "git" -Arguments @("commit", "-m", "Initial commit: Jelly Jump Web Lens")
}

$visibilityFlag = if ($Visibility -eq "Public") { "--public" } else { "--private" }
Invoke-Checked -Command "gh" -Arguments @("repo", "create", $RepositoryName, $visibilityFlag, "--source", ".", "--remote", "origin", "--push")
Write-Host "Jelly Jump repository created and pushed successfully." -ForegroundColor Green
