$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.4.0/env2op-windows-x64.zip'
    checksum64     = '69445ABFB762D359CF079DCF419CB1A0EC162F0020F627CD0EDB00A2F452DE1E'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
