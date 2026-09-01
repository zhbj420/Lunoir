$f = "src/shared/i18n/fr.ts"
$text = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
$lsquo = [System.Text.Encoding]::UTF8.GetString([byte[]](0xe2,0x80,0x98))
$rsquo = [System.Text.Encoding]::UTF8.GetString([byte[]](0xe2,0x80,0x99))
$text = $text.Replace($lsquo, "\'").Replace($rsquo, "\'")
[System.IO.File]::WriteAllText($f, $text, [System.Text.Encoding]::UTF8)
Write-Host "done"
