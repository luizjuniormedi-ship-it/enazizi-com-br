$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $repoRoot '.env.e2e.local'

$email = Read-Host 'Email da conta exclusiva de teste E2E'
$securePassword = Read-Host 'Senha da conta exclusiva de teste E2E' -AsSecureString

if ([string]::IsNullOrWhiteSpace($email)) {
  throw 'O email E2E nao pode ficar vazio.'
}

$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  if ([string]::IsNullOrWhiteSpace($password)) {
    throw 'A senha E2E nao pode ficar vazia.'
  }

  $escapedEmail = $email.Replace('\', '\\').Replace('"', '\"')
  $escapedPassword = $password.Replace('\', '\\').Replace('"', '\"')
  $contents = @(
    '# Local only. Never commit this file.'
    ('E2E_USER_EMAIL="' + $escapedEmail + '"')
    ('E2E_USER_PASSWORD="' + $escapedPassword + '"')
  ) -join [Environment]::NewLine

  [IO.File]::WriteAllText($targetPath, $contents + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}
finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
  $password = $null
  $securePassword.Dispose()
}

$ignored = git -C $repoRoot check-ignore --quiet -- '.env.e2e.local'
if ($LASTEXITCODE -ne 0) {
  throw '.env.e2e.local nao esta protegido pelo .gitignore. Nao execute os testes ate corrigir isso.'
}

Write-Host "Configuracao E2E salva localmente em: $targetPath"
Write-Host 'A senha nao foi exibida. Execute: npm run test:user:auth'
