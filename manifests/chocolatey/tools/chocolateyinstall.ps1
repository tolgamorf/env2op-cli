$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.2.8/env2op-windows-x64.zip'
    checksum64     = '1A3B8119BADD0BF97D85924B6339F08651B29542E823BAB551DBF931EAEB9943'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
