$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.2.5/env2op-windows-x64.zip'
    checksum64     = 'A4A43120FCDAC0E4A4CB5AA1AC62BFA8E01C187B28B3084900BDE37130069F37'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
