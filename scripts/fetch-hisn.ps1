Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)

Write-Host "Fetching chapter index..."
$jsonAr = $client.GetStringAsync("https://hisnmuslim.com/api/ar/husn_ar.json").Result
$objAr = $jsonAr | ConvertFrom-Json
$chaptersAr = $objAr.PSObject.Properties | Select-Object -First 1 | ForEach-Object { $_.Value }
Write-Host "  Found $($chaptersAr.Count) Arabic chapters"

$jsonEn = $client.GetStringAsync("https://hisnmuslim.com/api/en/husn_en.json").Result
$objEn = $jsonEn | ConvertFrom-Json
$chaptersEn = $objEn.PSObject.Properties | Select-Object -First 1 | ForEach-Object { $_.Value }
Write-Host "  Found $($chaptersEn.Count) English chapters"

$enLookup = @{}
foreach ($ch in $chaptersEn) { $enLookup[[int]$ch.ID] = $ch }

$allChapters = @()
$total = $chaptersAr.Count
$i = 0

foreach ($ch in $chaptersAr) {
  $i++
  $id = [int]$ch.ID
  $titleAr = [string]$ch.TITLE
  $audioUrl = [string]$ch.AUDIO_URL
  $textUrl = [string]$ch.TEXT
  $enCh = $enLookup[$id]
  $titleEn = if ($enCh) { [string]$enCh.TITLE } else { "" }
  $textUrlEn = if ($enCh) { [string]$enCh.TEXT } else { "" }

  Write-Host "[$id/$total] $titleAr"

  $itemsAr = @()
  try {
    $t = $client.GetStringAsync($textUrl).Result
    $data = $t | ConvertFrom-Json
    $itemsAr = $data.PSObject.Properties | Select-Object -First 1 | ForEach-Object { $_.Value }
  } catch { Write-Host "  Ar fail: $_" }

  $itemsEn = @()
  if ($textUrlEn) {
    try {
      $t = $client.GetStringAsync($textUrlEn).Result
      $data = $t | ConvertFrom-Json
      $itemsEn = $data.PSObject.Properties | Select-Object -First 1 | ForEach-Object { $_.Value }
    } catch { Write-Host "  En fail: $_" }
  }

  $items = @()
  $max = [Math]::Max($itemsAr.Count, $itemsEn.Count)
  for ($j = 0; $j -lt $max; $j++) {
    $arItem = if ($j -lt $itemsAr.Count) { $itemsAr[$j] } else { $null }
    $enItem = if ($j -lt $itemsEn.Count) { $itemsEn[$j] } else { $null }
    $items += @(@{
      label = "$id-$($j+1)"
      ar = if ($arItem) { [string]$arItem.ARABIC_TEXT } else { "" }
      en = if ($enItem) { [string]$enItem.TRANSLATED_TEXT } else { "" }
      transliteration = if ($enItem) { [string]$enItem.LANGUAGE_ARABIC_TRANSLATED_TEXT } else { "" }
      repeat = if ($arItem -and $arItem.REPEAT) { [int]$arItem.REPEAT } elseif ($enItem -and $enItem.REPEAT) { [int]$enItem.REPEAT } else { 1 }
      audio = if ($arItem -and $arItem.AUDIO) { [string]$arItem.AUDIO } elseif ($enItem -and $enItem.AUDIO) { [string]$enItem.AUDIO } else { "" }
    })
  }

  $allChapters += @(@{
    id = "ch-$id"
    title = $titleAr
    title_en = $titleEn
    audio = $audioUrl
    items = $items
  })

  Start-Sleep -Milliseconds 100
}

$json = $allChapters | ConvertTo-Json -Depth 10 -Compress
$outPath = "G:\Github Repos\Tasbee7\assets\hisn_complete.json"
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done! $($allChapters.Count) chapters saved to $outPath"
