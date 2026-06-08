Add-Type -AssemblyName System.Net.Http
$c = New-Object System.Net.Http.HttpClient
$t = $c.GetStringAsync('https://hisnmuslim.com/api/ar/husn_ar.json').Result
Write-Host "Length: $($t.Length)"
Write-Host $t.Substring(0, [Math]::Min(1000, $t.Length))
