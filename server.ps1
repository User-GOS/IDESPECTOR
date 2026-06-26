# IDespector — servidor local com WhatsApp + Telegram
param([int]$Port = 8772)

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

if ($env:IDESPECTOR_OPEN_BROWSER -eq '1') {
    Start-Sleep -Milliseconds 400
    Start-Process "http://localhost:$Port/idespector.html"
}

Write-Host "IDespector rodando em http://localhost:$Port/idespector.html"
Write-Host "WhatsApp API: POST http://localhost:$Port/api/whatsapp"
Write-Host "Telegram API: POST http://localhost:$Port/api/telegram/send"
Write-Host "Tradutor API: GET http://localhost:$Port/api/translate?q=ola&langpair=pt|en"
Write-Host "Outlook ICS: POST http://localhost:$Port/api/outlook/ics"
Write-Host "Noticias: GET http://localhost:$Port/api/news/daily"
Write-Host "Pressione Ctrl+C para parar."

function Add-CorsHeaders($response) {
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
    $response.Headers.Add("Pragma", "no-cache")
}

function Send-Json($response, $statusCode, $obj) {
    Add-CorsHeaders $response
    $response.StatusCode = $statusCode
    $response.ContentType = "application/json; charset=utf-8"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
}

function Read-JsonBody($request) {
    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
    $body = $reader.ReadToEnd()
    $reader.Close()
    return $body | ConvertFrom-Json
}

function Invoke-GoogleTranslate($text, $from, $to) {
    $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=$from&tl=$to&dt=t&q=" + [uri]::EscapeDataString($text)
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 25
    $json = $resp.Content | ConvertFrom-Json
    $out = ""
    if ($json -and $json[0]) {
        foreach ($part in $json[0]) {
            if ($part -and $part[0]) { $out += [string]$part[0] }
        }
    }
    $out = $out.Trim()
    if ([string]::IsNullOrWhiteSpace($out)) {
        throw "Resposta vazia do Google Translate"
    }
    return $out
}

function Invoke-TelegramGet($token, $method, $query) {
    $url = "https://api.telegram.org/bot$token/$method"
    if ($query) { $url += "?" + $query }
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 25
    return $resp.Content | ConvertFrom-Json
}

function Invoke-TelegramApi($token, $method, $body) {
    $url = "https://api.telegram.org/bot$token/$method"
    $json = if ($body) { $body | ConvertTo-Json -Compress } else { "{}" }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = "POST"
    $req.ContentType = "application/json; charset=utf-8"
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $resp = $req.GetResponse()
    $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $sr.ReadToEnd()
    $sr.Close()
    $resp.Close()
    return $text | ConvertFrom-Json
}

function Get-TelegramChatId($token) {
    try { Invoke-TelegramGet $token "deleteWebhook" "drop_pending_updates=false" | Out-Null } catch {}
    $tg = Invoke-TelegramGet $token "getUpdates" "limit=100&timeout=0"
    if (-not $tg.ok) { return @{ ok = $false; error = $tg.description } }
    $updates = @($tg.result)
    if ($updates.Count -eq 0) {
        return @{ ok = $false; error = "Nenhuma mensagem encontrada. Abra seu bot no Telegram e envie /start." }
    }
    $chatId = $null
    $lastUpdateId = 0
    for ($i = $updates.Count - 1; $i -ge 0; $i--) {
        $u = $updates[$i]
        $chat = $null
        if ($u.message -and $u.message.chat) { $chat = $u.message.chat }
        elseif ($u.edited_message -and $u.edited_message.chat) { $chat = $u.edited_message.chat }
        elseif ($u.callback_query -and $u.callback_query.message -and $u.callback_query.message.chat) {
            $chat = $u.callback_query.message.chat
        }
        if ($chat -and $chat.id) {
            $chatId = [string]$chat.id
            $lastUpdateId = [int]$u.update_id
            break
        }
    }
    if (-not $chatId) {
        return @{ ok = $false; error = "Mensagens encontradas, mas sem Chat ID. Envie /start ao seu bot." }
    }
    try {
        Invoke-TelegramGet $token "getUpdates" ("offset=" + ($lastUpdateId + 1) + "&limit=1") | Out-Null
    } catch {}
    return @{ ok = $true; chatId = $chatId }
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $path = $request.Url.LocalPath

    try {
        if ($request.HttpMethod -eq "OPTIONS") {
            Add-CorsHeaders $response
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        if ($path -eq "/api/health" -and $request.HttpMethod -eq "GET") {
            Send-Json $response 200 @{ ok = $true; port = $Port }
            continue
        }

        if ($path -eq "/api/translate" -and $request.HttpMethod -eq "GET") {
            $q = [string]$request.QueryString["q"]
            if ([string]::IsNullOrWhiteSpace($q)) { $q = [string]$request.QueryString["text"] }
            $langpair = [string]$request.QueryString["langpair"]
            if ([string]::IsNullOrWhiteSpace($q)) {
                Send-Json $response 400 @{ ok = $false; error = "Parametro q obrigatorio" }
                continue
            }
            if ([string]::IsNullOrWhiteSpace($langpair) -or $langpair -notmatch '^[a-z]{2}\|[a-z]{2}$') {
                Send-Json $response 400 @{ ok = $false; error = "langpair invalido (ex: pt|en)" }
                continue
            }
            try {
                $parts = $langpair -split '\|', 2
                $from = $parts[0]
                $to = $parts[1]
                $text = Invoke-GoogleTranslate $q $from $to
                Send-Json $response 200 @{ ok = $true; text = $text; langpair = $langpair; provider = "google" }
            } catch {
                try {
                    $apiUrl = "https://api.mymemory.translated.net/get?q=" + [uri]::EscapeDataString($q) + "&langpair=" + [uri]::EscapeDataString($langpair)
                    $api = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 25
                    if ([int]$api.responseStatus -ne 200) {
                        Send-Json $response 502 @{ ok = $false; error = $api.responseDetails }
                        continue
                    }
                    $text = [string]$api.responseData.translatedText
                    if ($api.matches -and $api.matches.Count -gt 0) {
                        foreach ($m in ($api.matches | Sort-Object { [double]$_.match } -Descending)) {
                            $candidate = [string]$m.translation
                            if (-not [string]::IsNullOrWhiteSpace($candidate) -and $candidate -notmatch 'MYMEMORY WARNING|INVALID' -and ($candidate.ToLower() -ne $q.ToLower())) {
                                $text = $candidate
                                break
                            }
                        }
                    }
                    if ([string]::IsNullOrWhiteSpace($text) -or $text -match 'MYMEMORY WARNING|INVALID') {
                        Send-Json $response 502 @{ ok = $false; error = "Traducao indisponivel" }
                        continue
                    }
                    Send-Json $response 200 @{ ok = $true; text = $text.Trim(); langpair = $langpair; provider = "mymemory" }
                } catch {
                    Send-Json $response 502 @{ ok = $false; error = "Erro ao traduzir: $($_.Exception.Message)" }
                }
            }
            continue
        }

        if ($path -eq "/api/telegram/send" -and $request.HttpMethod -eq "POST") {
            $data = Read-JsonBody $request
            $token = [string]$data.token
            $chatId = [string]$data.chatId
            $text = [string]$data.text
            if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($chatId) -or [string]::IsNullOrWhiteSpace($text)) {
                Send-Json $response 400 @{ ok = $false; error = "token, chatId e text sao obrigatorios" }
                continue
            }
            try {
                $tg = Invoke-TelegramApi $token "sendMessage" @{ chat_id = $chatId; text = $text }
                if ($tg.ok) {
                    Send-Json $response 200 @{ ok = $true; message = "Mensagem enviada ao Telegram" }
                } else {
                    Send-Json $response 400 @{ ok = $false; error = $tg.description }
                }
            } catch {
                Send-Json $response 502 @{ ok = $false; error = "Erro ao contactar Telegram: $($_.Exception.Message)" }
            }
            continue
        }

        if ($path -eq "/api/telegram/validate" -and $request.HttpMethod -eq "POST") {
            $data = Read-JsonBody $request
            $token = [string]$data.token
            if ([string]::IsNullOrWhiteSpace($token)) {
                Send-Json $response 400 @{ ok = $false; error = "token obrigatorio" }
                continue
            }
            try {
                try { Invoke-TelegramGet $token "deleteWebhook" "drop_pending_updates=false" | Out-Null } catch {}
                $tg = Invoke-TelegramGet $token "getMe" ""
                if ($tg.ok) {
                    $username = $tg.result.username
                    Send-Json $response 200 @{ ok = $true; botUsername = $username; botLink = "https://t.me/$username" }
                } else {
                    Send-Json $response 400 @{ ok = $false; error = $tg.description }
                }
            } catch {
                Send-Json $response 502 @{ ok = $false; error = "Erro ao validar token: $($_.Exception.Message)" }
            }
            continue
        }

        if ($path -eq "/api/telegram/chatid" -and $request.HttpMethod -eq "POST") {
            $data = Read-JsonBody $request
            $token = [string]$data.token
            if ([string]::IsNullOrWhiteSpace($token)) {
                Send-Json $response 400 @{ ok = $false; error = "token obrigatorio" }
                continue
            }
            try {
                $result = Get-TelegramChatId $token
                if ($result.ok) {
                    Send-Json $response 200 @{ ok = $true; chatId = $result.chatId }
                } else {
                    Send-Json $response 404 @{ ok = $false; error = $result.error }
                }
            } catch {
                Send-Json $response 502 @{ ok = $false; error = "Erro ao buscar chat: $($_.Exception.Message)" }
            }
            continue
        }

        if ($path -eq "/api/outlook/ics" -and $request.HttpMethod -eq "POST") {
            $data = Read-JsonBody $request
            $url = [string]$data.url
            if ([string]::IsNullOrWhiteSpace($url)) {
                Send-Json $response 400 @{ ok = $false; error = "url obrigatoria" }
                continue
            }
            $url = $url.Trim() -replace '^webcal:', 'https:'
            try {
                $ics = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
                $text = $ics.Content
                if (-not $text -or $text -notmatch 'BEGIN:VCALENDAR') {
                    Send-Json $response 400 @{ ok = $false; error = "Resposta nao parece um calendario ICS valido" }
                    continue
                }
                Send-Json $response 200 @{ ok = $true; ics = $text }
            } catch {
                Send-Json $response 502 @{ ok = $false; error = "Erro ao baixar ICS: $($_.Exception.Message)" }
            }
            continue
        }

        if ($path -eq "/api/news/daily" -and $request.HttpMethod -eq "GET") {
            $limit = 8
            try {
                $limitRaw = [string]$request.QueryString["limit"]
                if ($limitRaw -match '^\d+$') { $limit = [Math]::Min([Math]::Max([int]$limitRaw, 1), 15) }
            } catch {}
            $feeds = @(
                @{ name = "Google News BR"; url = "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419" },
                @{ name = "G1"; url = "https://g1.globo.com/rss/g1/" },
                @{ name = "UOL"; url = "https://rss.uol.com.br/feed/index.xml" }
            )
            $newsResult = $null
            foreach ($feed in $feeds) {
                try {
                    $resp = Invoke-WebRequest -Uri $feed.url -UseBasicParsing -TimeoutSec 15 -Headers @{ "User-Agent" = "IDespector/1.0" }
                    [xml]$xml = $resp.Content
                    $rawItems = @($xml.rss.channel.item)
                    if ($rawItems.Count -eq 0) { continue }
                    $items = @()
                    foreach ($it in ($rawItems | Select-Object -First $limit)) {
                        $title = [string]$it.title
                        $source = ""
                        if ($it.source) {
                            if ($it.source.'#text') { $source = [string]$it.source.'#text' }
                            else { $source = [string]$it.source }
                        }
                        if (-not $source -and $title -match ' - (.+)$') {
                            $source = $Matches[1]
                            $title = $title -replace ' - .+$',''
                        } elseif ($source -and $title.EndsWith(" - $source")) {
                            $title = $title.Substring(0, $title.Length - ($source.Length + 3)).Trim()
                        }
                        $items += @{
                            title = $title.Trim()
                            url = [string]$it.link
                            source = if ($source) { $source.Trim() } else { "Noticias" }
                            publishedAt = [string]$it.pubDate
                        }
                    }
                    if ($items.Count -gt 0) {
                        $newsResult = @{
                            ok = $true
                            date = (Get-Date -Format "yyyy-MM-dd")
                            feed = $feed.name
                            items = $items
                        }
                        break
                    }
                } catch {}
            }
            if ($newsResult) {
                Send-Json $response 200 $newsResult
            } else {
                Send-Json $response 502 @{ ok = $false; error = "Nenhuma fonte de noticias disponivel" }
            }
            continue
        }

        if ($path -eq "/api/whatsapp" -and $request.HttpMethod -eq "POST") {
            $data = Read-JsonBody $request
            $phone = [string]$data.phone
            $apikey = [string]$data.apikey
            $text = [string]$data.text

            if ([string]::IsNullOrWhiteSpace($phone) -or [string]::IsNullOrWhiteSpace($apikey) -or [string]::IsNullOrWhiteSpace($text)) {
                Send-Json $response 400 @{ ok = $false; error = "phone, apikey e text sao obrigatorios" }
                continue
            }

            $phone = $phone.Trim() -replace '[\s\-\(\)]', ''
            if ($phone -notmatch '^\+') {
                if ($phone -match '^(55)?(\d{10,11})$') {
                    $digits = if ($Matches[1]) { $phone } else { "55$phone" }
                    $phone = "+$digits"
                } else { $phone = "+$phone" }
            }

            $exampleKeys = @('123123','123456','1234567','0000000','1234567890')
            if ($exampleKeys -contains $apikey.Trim()) {
                Send-Json $response 400 @{ ok = $false; error = "API Key de exemplo invalida. Use a chave REAL que o CallMeBot enviou no seu WhatsApp." }
                continue
            }

            $encodedText = [uri]::EscapeDataString($text)
            $encodedPhone = [uri]::EscapeDataString($phone)
            $url = "https://api.callmebot.com/whatsapp.php?phone=$encodedPhone&apikey=$apikey&text=$encodedText"

            $respBody = ""
            $statusCode = 0
            try {
                $wa = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 25
                $statusCode = [int]$wa.StatusCode
                $respBody = if ($wa.Content) { $wa.Content.Trim() } else { "" }
            } catch [System.Net.WebException] {
                $httpResp = $_.Exception.Response
                if ($httpResp) {
                    $statusCode = [int]$httpResp.StatusCode
                    $sr = New-Object System.IO.StreamReader($httpResp.GetResponseStream())
                    $respBody = $sr.ReadToEnd().Trim()
                    $sr.Close()
                } else {
                    Send-Json $response 502 @{ ok = $false; error = "Sem conexao com CallMeBot. Verifique sua internet."; detail = $_.Exception.Message }
                    continue
                }
            } catch {
                Send-Json $response 502 @{ ok = $false; error = "Erro ao contactar CallMeBot: $($_.Exception.Message)"; detail = "" }
                continue
            }

            $hasError = $respBody -imatch 'invalid|error|wrong|not activated|not found|denied|expired|APIKey is invalid'
            if ($hasError) {
                $msg = "API Key invalida ou WhatsApp nao ativado."
                if ($respBody -imatch 'APIKey is invalid') { $msg = "API Key incorreta. Use a chave REAL do CallMeBot (nao use 123123)." }
                elseif ($respBody -imatch 'not activated') { $msg = "WhatsApp nao ativado. Envie a mensagem de ativacao ao CallMeBot." }
                Send-Json $response 400 @{ ok = $false; error = $msg; detail = $respBody; status = $statusCode }
            } else {
                Send-Json $response 200 @{ ok = $true; status = $statusCode; message = "Mensagem enviada ao WhatsApp"; detail = $respBody }
            }
            continue
        }

        $localPath = $path.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($localPath)) { $localPath = "idespector.html" }
        $file = Join-Path $Root ($localPath -replace '/', '\')

        if (Test-Path $file -PathType Leaf) {
            Add-CorsHeaders $response
            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $ctype = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.css'  { 'text/css' }
                '.js'   { 'application/javascript' }
                '.json' { 'application/json' }
                '.png'  { 'image/png' }
                '.ico'  { 'image/x-icon' }
                '.svg'  { 'image/svg+xml' }
                default { 'application/octet-stream' }
            }
            $response.ContentType = $ctype
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
    } catch {
        try {
            Send-Json $response 500 @{ ok = $false; error = $_.Exception.Message }
        } catch {}
    } finally {
        if ($response.OutputStream.CanWrite) { $response.Close() }
    }
}
