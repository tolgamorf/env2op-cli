$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.2.9/env2op-windows-x64.zip'
    checksum64     = 'C75C79E7AB561B7A10FB2FD7F57CDE88058797F4E92402A86B1FF4B738FB1ADF'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
