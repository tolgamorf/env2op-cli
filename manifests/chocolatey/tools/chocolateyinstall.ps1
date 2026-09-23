$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.4.1/env2op-windows-x64.zip'
    checksum64     = '06FA21BBFE9B759C56D726585EDB33AEC7FAA9D42BC014C8CD255054A402DD9A'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
