$file = "src/shared/i18n/fr.ts"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$lsquo = [char]0x2018
$rsquo = [char]0x2019
$apos = "'"
$fixed = $content.Replace($lsquo, $apos).Replace($rsquo, $apos)
$countL = ($content.Length - $content.Replace($lsquo, "").Length)
$countR = ($content.Length - $content.Replace($rsquo, "").Length)
[System.IO.File]::WriteAllText($file, $fixed, [System.Text.Encoding]::UTF8)
Write-Host "replaced $countL U+2018 and $countR U+2019"
