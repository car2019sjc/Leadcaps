$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot '..\deploy\configure-anthropic-windows.ps1'
$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'The Windows configurator has syntax errors.' }
. $scriptPath
$controls = New-LeadcapsCredentialDialog
$fakeKey = 'fictitious-windows-key-1234567890'
$probePath = Join-Path $env:TEMP ('leadcaps-stdin-probe-' + [guid]::NewGuid().ToString('N') + '.exe')
try {
    if (-not $controls.KeyBox.UseSystemPasswordChar) { throw 'The key field must be masked.' }
    [System.Windows.Forms.Clipboard]::SetText($fakeKey)
    $controls.Form.Show()
    [System.Windows.Forms.Application]::DoEvents()
    $controls.PasteButton.PerformClick()
    if ($controls.KeyBox.Text -cne $fakeKey) { throw 'Paste key did not retrieve the Windows clipboard.' }
    $controls.Form.Hide()
    $source = @'
using System;
public class PrivateInputProbe {
    public static int Main(string[] args) {
        string body = Console.In.ReadToEnd();
        string secret = "fictitious-windows-key-1234567890";
        if (string.Join(" ", args).Contains(secret)) return 10;
        if (args.Length != 3 || args[0] != "-T" || args[1] != "root@example.test") return 11;
        if (!args[2].EndsWith("--from-stdin")) return 12;
        if (!body.Contains("\"key\":\"" + secret + "\"")) return 13;
        if (!body.Contains("\"model\":\"claude-test\"")) return 14;
        Console.WriteLine("PRIVATE_PAYLOAD_OK");
        return 0;
    }
}
'@
    Add-Type -TypeDefinition $source -OutputAssembly $probePath -OutputType ConsoleApplication
    $configuration = @{ key = $fakeKey; model = 'claude-test'; workspace = '' }
    $result = Send-LeadcapsPrivateConfiguration -Configuration $configuration -Destination 'root@example.test' -SshExecutable $probePath
    if ($result -cne 'PRIVATE_PAYLOAD_OK') { throw 'The credential was not sent through private stdin.' }
    Write-Host 'Windows clipboard, masked field, syntax and private native stdin checks passed.'
} finally {
    $controls.KeyBox.Clear()
    $controls.Form.Dispose()
    [System.Windows.Forms.Clipboard]::Clear()
    Remove-Item -LiteralPath $probePath -ErrorAction SilentlyContinue
}
