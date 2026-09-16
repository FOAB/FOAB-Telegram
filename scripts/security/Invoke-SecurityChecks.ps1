[CmdletBinding()]
param(
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

$script:TruffleHogVersion = '3.97.4'
$script:TruffleHogDigests = @{
    WindowsX64 = '6ce9a957ac62bfb19463048333d9e8481327dbbf5bdc0c43f5ab5327b9631fb9'
    LinuxX64   = 'dc24007c2f233bd61c05beabeb44aa27ea9b43288166279209abe0458c5ce76b'
}

function Get-RepositoryRoot {
    $root = (& git -C $PSScriptRoot rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw 'Run this check from a Git working tree.'
    }

    return [IO.Path]::GetFullPath(($root | Select-Object -First 1).Trim())
}

function Get-TruffleHogPath {
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $platform = [Runtime.InteropServices.RuntimeInformation]::OSDescription
    $architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    $runningWindows = $IsWindows -or $env:OS -eq 'Windows_NT'

    if ($architecture -ne 'X64') {
        throw "TruffleHog $script:TruffleHogVersion is pinned for x64 Windows and Linux runners; found architecture '$architecture'."
    }

    if ($runningWindows) {
        $asset = "trufflehog_$($script:TruffleHogVersion)_windows_amd64.tar.gz"
        $expectedDigest = $script:TruffleHogDigests.WindowsX64
        $executableName = 'trufflehog.exe'
    } elseif ($IsLinux) {
        $asset = "trufflehog_$($script:TruffleHogVersion)_linux_amd64.tar.gz"
        $expectedDigest = $script:TruffleHogDigests.LinuxX64
        $executableName = 'trufflehog'
    } else {
        throw "TruffleHog is not configured for this operating system: $platform."
    }

    $toolDirectory = Join-Path $RepositoryRoot ".tools/security/trufflehog/$($script:TruffleHogVersion)"
    $executable = Join-Path $toolDirectory $executableName
    if (Test-Path -LiteralPath $executable -PathType Leaf) {
        return $executable
    }

    New-Item -ItemType Directory -Path $toolDirectory -Force | Out-Null
    $archive = Join-Path $toolDirectory $asset
    $downloadUri = "https://github.com/trufflesecurity/trufflehog/releases/download/v$($script:TruffleHogVersion)/$asset"
    Invoke-WebRequest -Uri $downloadUri -OutFile $archive

    $actualDigest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualDigest -ne $expectedDigest) {
        Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
        throw 'The downloaded scanner archive did not match the pinned SHA-256 digest.'
    }

    & tar -xzf $archive -C $toolDirectory $executableName
    $extractExitCode = $LASTEXITCODE
    Remove-Item -LiteralPath $archive -Force
    if ($extractExitCode -ne 0 -or -not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw 'The verified scanner archive could not be extracted.'
    }

    return $executable
}

function Invoke-Scanner {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $output = @(& $Executable @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    $output = $null
    return $exitCode
}

function ConvertTo-ScannerPathRegex {
    param([Parameter(Mandatory)][string]$RelativePath)

    $normalizedPath = $RelativePath.Replace('\', '/')
    $escapedPath = [regex]::Escape($normalizedPath).Replace('/', '[\\/]')
    return "(^|[\\/])$escapedPath$"
}

function Get-GitVisiblePaths {
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $paths = @(& git -C $RepositoryRoot ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) {
        throw 'Git could not enumerate tracked and non-ignored working-tree files.'
    }

    return @($paths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Assert-NoIgnoredTrackedFiles {
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $ignoredTrackedPaths = @(& git -C $RepositoryRoot ls-files --cached --ignored --exclude-standard)
    if ($LASTEXITCODE -ne 0) {
        throw 'Git could not check the index for ignored paths.'
    }

    if ($ignoredTrackedPaths.Count -gt 0) {
        throw 'The Git index contains one or more ignored paths. Remove them from the index before scanning.'
    }
}

function New-GitVisibleIncludeFile {
    param([Parameter(Mandatory)][string]$RepositoryRoot)

    $paths = Get-GitVisiblePaths -RepositoryRoot $RepositoryRoot
    if ($paths.Count -eq 0) {
        throw 'Git returned no files to scan.'
    }

    $includeFile = Join-Path ([IO.Path]::GetTempPath()) "foab-secret-scan-includes-$([guid]::NewGuid().ToString('N')).txt"
    $patterns = [string[]]@($paths | ForEach-Object { ConvertTo-ScannerPathRegex -RelativePath $_ })
    [IO.File]::WriteAllLines($includeFile, $patterns, [Text.UTF8Encoding]::new($false))
    return $includeFile
}

function Assert-SyntheticScannerBehavior {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][string]$RepositoryRoot
    )

    $gitVisiblePaths = Get-GitVisiblePaths -RepositoryRoot $RepositoryRoot
    if ($gitVisiblePaths -contains '.env') {
        throw 'The ignored local .env file unexpectedly appears among Git-visible scanner inputs.'
    }
    if ($gitVisiblePaths -notcontains '.env.example') {
        throw 'The safe .env.example template is missing from Git-visible scanner inputs.'
    }

    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $testDirectoryName = "foab-secret-scan-$([guid]::NewGuid().ToString('N'))"
    $testDirectory = [IO.Path]::GetFullPath((Join-Path $tempRoot $testDirectoryName))
    if (-not $testDirectory.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The synthetic test directory resolved outside the system temporary directory.'
    }

    New-Item -ItemType Directory -Path $testDirectory | Out-Null
    try {
        $randomTokenBytes = [byte[]]::new(18)
        [Security.Cryptography.RandomNumberGenerator]::Fill($randomTokenBytes)
        $syntheticToken = 'ghp_' + [Convert]::ToHexString($randomTokenBytes).ToLowerInvariant()
        $credentialFixture = Join-Path $testDirectory 'credential-fixture.txt'
        Set-Content -LiteralPath $credentialFixture -Value "token=$syntheticToken" -NoNewline

    $positive = Invoke-Scanner -Executable $Executable -Arguments @(
            'filesystem', $testDirectory, '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries'
        )
        if ($positive -eq 0) {
            throw 'The scanner did not detect the synthetic positive credential fixture.'
        }

        Set-Content -LiteralPath $credentialFixture -Value 'token=synthetic-placeholder-value' -NoNewline
    $negative = Invoke-Scanner -Executable $Executable -Arguments @(
            'filesystem', $testDirectory, '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries'
        )
        if ($negative -ne 0) {
            throw 'The scanner failed its synthetic negative test.'
        }

        $includedPath = 'nested/credential-fixture.txt'
        $includedDirectory = Join-Path $testDirectory 'nested'
        New-Item -ItemType Directory -Path $includedDirectory | Out-Null
        $includedCredential = Join-Path $includedDirectory 'credential-fixture.txt'
        Set-Content -LiteralPath $includedCredential -Value "token=$syntheticToken" -NoNewline
        $ignoredEnvironmentFixture = Join-Path $testDirectory '.env'
        Set-Content -LiteralPath $ignoredEnvironmentFixture -Value "token=$syntheticToken" -NoNewline
        $includeFile = Join-Path $testDirectory 'include-paths.txt'
        [IO.File]::WriteAllLines(
            $includeFile,
            [string[]]@((ConvertTo-ScannerPathRegex -RelativePath $includedPath)),
            [Text.UTF8Encoding]::new($false)
        )
        $includePositive = Invoke-Scanner -Executable $Executable -Arguments @(
            'filesystem', $testDirectory, '--include-paths', $includeFile,
            '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries'
        )
        if ($includePositive -eq 0) {
            throw 'The scanner did not detect the synthetic credential in an explicitly included path.'
        }

        Set-Content -LiteralPath $includedCredential -Value 'token=synthetic-placeholder-value' -NoNewline
        $includeNegative = Invoke-Scanner -Executable $Executable -Arguments @(
            'filesystem', $testDirectory, '--include-paths', $includeFile,
            '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries'
        )
        if ($includeNegative -ne 0) {
            throw 'The scanner did not honor the explicit include paths for an ignored local .env fixture.'
        }
    } finally {
        if (Test-Path -LiteralPath $testDirectory -PathType Container) {
            Remove-Item -LiteralPath $testDirectory -Recurse -Force
        }
    }

    Write-Host 'Secret scanner synthetic positive and negative checks passed; captured scanner output was suppressed.'
}

try {
    $repositoryRoot = Get-RepositoryRoot
    $truffleHog = Get-TruffleHogPath -RepositoryRoot $repositoryRoot
    Assert-NoIgnoredTrackedFiles -RepositoryRoot $repositoryRoot

    if ($SelfTest) {
        Assert-SyntheticScannerBehavior -Executable $truffleHog -RepositoryRoot $repositoryRoot
    }

    $exclusions = Join-Path $repositoryRoot 'scripts/security/secret-scan-excludes.txt'
    $includeFile = New-GitVisibleIncludeFile -RepositoryRoot $repositoryRoot
    try {
        $filesystemScan = Invoke-Scanner -Executable $truffleHog -Arguments @(
            'filesystem', $repositoryRoot, '--include-paths', $includeFile, '--exclude-paths', $exclusions,
            '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries', '--force-skip-archives'
        )
        if ($filesystemScan -ne 0) {
            throw 'The Git-visible working-tree scan found a potential credential or could not complete. Scanner output was suppressed to protect secret values.'
        }
    } finally {
        Remove-Item -LiteralPath $includeFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host 'Git-visible working-tree secret scan passed; ignored local files were excluded.'

    if ($IsWindows -or $env:OS -eq 'Windows_NT') {
        # TruffleHog currently duplicates the drive letter for RFC 8089 triple-slash URIs on Windows.
        $gitUri = "file://$($repositoryRoot.Replace('\', '/'))"
    } else {
        $gitUri = ([Uri]$repositoryRoot).AbsoluteUri
    }
    $historyScan = Invoke-Scanner -Executable $truffleHog -Arguments @(
        'git', $gitUri, '--no-verification', '--no-update', '--fail', '--fail-on-scan-errors', '--force-skip-binaries'
    )
    if ($historyScan -ne 0) {
        throw 'The Git-history secret scan found a potential credential or could not complete. Scanner output was suppressed to protect secret values.'
    }
    Write-Host 'Git-history secret scan passed.'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
