$root = Get-Location
$output = Join-Path $root "PROJECT_SNAPSHOT.txt"

$exclude = @(
    "node_modules",
    ".git",
    "dist",
    ".vite",
    "PROJECT_SNAPSHOT.txt",
    "package.json",
    "package-lock.json",
    ".env",
    ".env.local"
)

function Is-Excluded($path) {
    foreach ($item in $exclude) {
        if ($path -match "[\\/]$([regex]::Escape($item))([\\/]|$)") {
            return $true
        }
    }

    return $false
}

"========================================" | Out-File $output
"CHURCHDESK PROJECT SNAPSHOT" | Out-File $output -Append
"Generated: $(Get-Date)" | Out-File $output -Append
"========================================" | Out-File $output -Append
"" | Out-File $output -Append

# ----------------------------------------
# FILE STRUCTURE
# ----------------------------------------

"========================================" | Out-File $output -Append
"FILE STRUCTURE" | Out-File $output -Append
"========================================" | Out-File $output -Append

Get-ChildItem -Path $root -Recurse -File |
    Where-Object { -not (Is-Excluded $_.FullName) } |
    ForEach-Object {
        $_.FullName.Substring($root.Path.Length + 1)
    } |
    Sort-Object |
    Out-File $output -Append

"" | Out-File $output -Append

# ----------------------------------------
# SOURCE FILE CONTENTS
# ----------------------------------------

"========================================" | Out-File $output -Append
"FILE CONTENTS" | Out-File $output -Append
"========================================" | Out-File $output -Append
"" | Out-File $output -Append

$extensions = @(
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".json",
    ".html",
    ".md"
)

Get-ChildItem -Path $root -Recurse -File |
    Where-Object {
        ($extensions -contains $_.Extension) -and
        (-not (Is-Excluded $_.FullName))
    } |
    Sort-Object FullName |
    ForEach-Object {

        $relative = $_.FullName.Substring($root.Path.Length + 1)

        "" | Out-File $output -Append
        "========================================" | Out-File $output -Append
        "FILE: $relative" | Out-File $output -Append
        "========================================" | Out-File $output -Append

        Get-Content $_.FullName |
            Out-File $output -Append

        "" | Out-File $output -Append
    }

Write-Host ""
Write-Host "Project snapshot created:"
Write-Host $output