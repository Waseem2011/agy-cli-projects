# PowerShell Script to Organize Assets
# Exclusions: .git, .venv, requirements.txt, static, templates

$targetDir = Get-Location

# Create folders if they don't exist
$folders = @("Images", "Documents", "Videos")
foreach ($folder in $folders) {
    $path = Join-Path $targetDir $folder
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

Write-Host "Organizing files in $targetDir..."

# 1. Move Images (.jpg, .jpeg, .gif)
$imageExtensions = @("*.jpg", "*.jpeg", "*.gif")
$images = Get-ChildItem -Path $targetDir -File -Include $imageExtensions
foreach ($file in $images) {
    $dest = Join-Path $targetDir "Images"
    Write-Host "Moving $($file.Name) -> Images/"
    Move-Item -Path $file.FullName -Destination $dest -Force
}

# 2. Move Documents (.txt, excluding requirements.txt)
$docs = Get-ChildItem -Path $targetDir -File -Filter "*.txt"
foreach ($file in $docs) {
    if ($file.Name -ne "requirements.txt") {
        $dest = Join-Path $targetDir "Documents"
        Write-Host "Moving $($file.Name) -> Documents/"
        Move-Item -Path $file.FullName -Destination $dest -Force
    }
}

# 3. Move Videos (.mp4)
$videos = Get-ChildItem -Path $targetDir -File -Filter "*.mp4"
foreach ($file in $videos) {
    $dest = Join-Path $targetDir "Videos"
    Write-Host "Moving $($file.Name) -> Videos/"
    Move-Item -Path $file.FullName -Destination $dest -Force
}

Write-Host "Organization complete!"
