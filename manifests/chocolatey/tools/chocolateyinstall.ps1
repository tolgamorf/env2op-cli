$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.2.11/env2op-windows-x64.zip'
    checksum64     = 'C5D4FF5A72F01F98E8CA1714547DD94C955322DD495252869583F75C0A9ADFAA'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
