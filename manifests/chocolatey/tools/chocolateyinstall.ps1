$ErrorActionPreference = 'Stop'
$toolsDir = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)"

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    unzipLocation  = $toolsDir
    url64bit       = 'https://github.com/tolgamorf/env2op-cli/releases/download/v0.2.10/env2op-windows-x64.zip'
    checksum64     = '419C49227808F612522A8D1363F9499871A0645F73BD1E69C4F6156B153AB9E2'
    checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs
