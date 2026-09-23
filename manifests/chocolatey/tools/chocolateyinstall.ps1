$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.3.0/env2op-windows-x64.zip'
    checksum64     = 'F67CDDF0FF94780A10D092DE3BBDD1A53B4FE900F2CE16FCCD47B4E48F5306FC'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
