# IDespector — publicar no GitHub
# Repositório: https://github.com/User-GOS/IDESPECTOR

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$RemoteUrl = "https://github.com/User-GOS/IDESPECTOR.git"
$Branch = "main"

function Find-Git {
    $candidates = @(
        "git",
        "${env:ProgramFiles}\Git\bin\git.exe",
        "${env:ProgramFiles(x86)}\Git\bin\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
    )
    foreach ($c in $candidates) {
        if ($c -eq "git") {
            $cmd = Get-Command git -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
        } elseif (Test-Path $c) { return $c }
    }
    return $null
}

$git = Find-Git
if (-not $git) {
    Write-Host ""
    Write-Host "Git nao encontrado." -ForegroundColor Red
    Write-Host "Instale em: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Depois execute este script novamente." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Set-Location $Root
Write-Host "Usando: $git" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $Root ".git"))) {
    Write-Host "Inicializando repositorio..." -ForegroundColor Green
    & $git init
    & $git branch -M $Branch
}

$remotes = & $git remote 2>$null
if ($remotes -notcontains "origin") {
    Write-Host "Adicionando remote origin..." -ForegroundColor Green
    & $git remote add origin $RemoteUrl
} else {
    & $git remote set-url origin $RemoteUrl
}

Write-Host "Adicionando arquivos..." -ForegroundColor Green
& $git add .

$status = & $git status --porcelain
if (-not $status) {
    Write-Host "Nenhuma alteracao para commitar." -ForegroundColor Yellow
} else {
    $msg = if ($args.Count -gt 0) { $args -join " " } else { "IDespector — painel de produtividade com integracoes" }
    & $git commit -m $msg
    Write-Host "Commit criado." -ForegroundColor Green
}

Write-Host "Enviando para GitHub ($RemoteUrl)..." -ForegroundColor Green
& $git push -u origin $Branch

Write-Host ""
Write-Host "Publicado com sucesso!" -ForegroundColor Green
Write-Host "https://github.com/User-GOS/IDESPECTOR" -ForegroundColor Cyan
Write-Host ""
