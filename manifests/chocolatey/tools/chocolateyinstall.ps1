$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.3.1/env2op-windows-x64.zip'
    checksum64     = '31798637845A1CECC077DDC2AB1C5AC80F4DB55AF4F0670F9E554BB9D38E04AB'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
