$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.5.0/env2op-windows-x64.zip'
    checksum64     = '9F8B5CB92B066DD791B4CB01119C0A48437AC6A21CD4BA7230C6B8E7F2D816FE'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
