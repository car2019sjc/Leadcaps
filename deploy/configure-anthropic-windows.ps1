param(
    [ValidatePattern('^[a-z_][a-z0-9_-]*@[A-Za-z0-9.-]+$')]
    [string]$SshTarget = 'root@177.153.38.233',
    [ValidateSet('Anthropic', 'SerpAPI')]
    [string]$Service = 'Anthropic'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function New-LeadcapsCredentialDialog {
    param([ValidateSet('Anthropic', 'SerpAPI')][string]$Service = 'Anthropic')
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'Leadcaps - configurar ' + $Service
    $form.ClientSize = New-Object System.Drawing.Size(590, 300)
    $form.FormBorderStyle = 'FixedDialog'
    $form.StartPosition = 'CenterScreen'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

    $intro = New-Object System.Windows.Forms.Label
    $intro.Text = "Copie a nova chave na $Service e clique em Colar chave.`nA chave sera enviada pela conexao SSH para /opt/leadcaps/.env."
    $intro.SetBounds(18, 16, 555, 48)
    $form.Controls.Add($intro)
    $keyLabel = New-Object System.Windows.Forms.Label
    $keyLabel.Text = 'Chave da API ' + $Service
    $keyLabel.SetBounds(18, 72, 430, 24)
    $form.Controls.Add($keyLabel)
    $keyBox = New-Object System.Windows.Forms.TextBox
    $keyBox.UseSystemPasswordChar = $true
    $keyBox.MaxLength = 500
    $keyBox.SetBounds(18, 100, 422, 28)
    $form.Controls.Add($keyBox)
    $paste = New-Object System.Windows.Forms.Button
    $paste.Text = 'Colar chave'
    $paste.SetBounds(450, 98, 120, 32)
    $paste.Add_Click({
        try {
            $keyBox.Text = [System.Windows.Forms.Clipboard]::GetText().Trim()
            $keyBox.Focus()
        } catch {
            [void][System.Windows.Forms.MessageBox]::Show('Copie a chave novamente no provedor e tente Colar chave.', 'Leadcaps')
        }
    }.GetNewClosure())
    $form.Controls.Add($paste)
    $workspaceLabel = New-Object System.Windows.Forms.Label
    $workspaceLabel.Text = 'Workspace (opcional; pode ficar vazio)'
    $workspaceLabel.SetBounds(18, 142, 550, 24)
    $form.Controls.Add($workspaceLabel)
    $workspaceBox = New-Object System.Windows.Forms.TextBox
    $workspaceBox.SetBounds(18, 170, 552, 28)
    $form.Controls.Add($workspaceBox)
    if ($Service -eq 'SerpAPI') { $workspaceLabel.Visible = $false; $workspaceBox.Visible = $false }
    $modelLabel = New-Object System.Windows.Forms.Label
    $modelLabel.Text = 'Modelo: Claude Sonnet 5.5. A VPS verificara o acesso.'
    if ($Service -eq 'SerpAPI') { $modelLabel.Text = 'Google Autocomplete. A VPS validara a chave sem pesquisar.' }
    $modelLabel.SetBounds(18, 210, 552, 24)
    $form.Controls.Add($modelLabel)
    $save = New-Object System.Windows.Forms.Button
    $save.Text = 'Salvar e aplicar'
    $save.SetBounds(308, 250, 142, 34)
    $save.Add_Click({
        if ($keyBox.Text.Trim() -notmatch '^[A-Za-z0-9_.-]{20,500}$' -or ($Service -eq 'SerpAPI' -and $keyBox.Text.Trim().Length -gt 200)) {
            [void][System.Windows.Forms.MessageBox]::Show('Copie somente a chave da API e clique em Colar chave.', 'Leadcaps')
            return
        }
        if ($workspaceBox.Text.Trim() -ne '' -and $workspaceBox.Text.Trim() -notmatch '^wrkspc_[A-Za-z0-9_-]{5,150}$') {
            [void][System.Windows.Forms.MessageBox]::Show('Confira o ID de workspace ou deixe o campo vazio.', 'Leadcaps')
            return
        }
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    }.GetNewClosure())
    $form.Controls.Add($save)
    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'Cancelar'
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $cancel.SetBounds(460, 250, 110, 34)
    $form.Controls.Add($cancel)
    $form.AcceptButton = $save
    $form.CancelButton = $cancel
    return [pscustomobject]@{ Form = $form; KeyBox = $keyBox; WorkspaceBox = $workspaceBox; PasteButton = $paste }
}

function Send-LeadcapsPrivateConfiguration {
    param(
        [hashtable]$Configuration,
        [string]$Destination,
        [string]$SshExecutable = 'ssh.exe',
        [ValidateSet('Anthropic', 'SerpAPI')][string]$Service = 'Anthropic'
    )
    $payload = ConvertTo-Json -InputObject $Configuration -Compress
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        # The secret travels only through stdin. -T prevents remote terminal echo.
        $remoteCommand = 'cd /opt/leadcaps && python3 deploy/configure_anthropic.py --from-stdin'
        if ($Service -eq 'SerpAPI') { $remoteCommand = 'cd /opt/leadcaps && python3 deploy/configure_serpapi.py --from-stdin' }
        $payload | & $SshExecutable -T $Destination $remoteCommand
        $resultCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
        $payload = $null
    }
    if ($resultCode -ne 0) {
        throw 'A configuracao nao foi aplicada. Confira a mensagem SSH ou do provedor acima; a chave nao sera exibida.'
    }
}

function Invoke-LeadcapsSshCommand {
    param([string]$Destination, [string]$RemoteCommand)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & ssh.exe -T $Destination $RemoteCommand
        $resultCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($resultCode -ne 0) { throw 'A etapa SSH falhou. Confira a mensagem acima antes de continuar.' }
}

function Start-LeadcapsWindowsConfiguration {
    param([string]$Destination, [ValidateSet('Anthropic', 'SerpAPI')][string]$Service = 'Anthropic')
    if ($env:OS -ne 'Windows_NT') { throw 'Execute este configurador no Windows.' }
    if ([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') { throw 'Inicie powershell.exe com o parametro -STA.' }
    [void](Get-Command ssh.exe -ErrorAction Stop)
    Write-Host 'Conectando a VPS e atualizando o configurador...'
    Write-Host 'Se houver pedido de senha SSH, informe a senha da VPS nesse pedido.'
    Invoke-LeadcapsSshCommand $Destination 'cd /opt/leadcaps && git pull --ff-only'
    $controls = New-LeadcapsCredentialDialog -Service $Service
    $configuration = $null
    try {
        if ($controls.Form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            Write-Host 'Configuracao cancelada. Nenhuma chave foi enviada.'
            return
        }
        $configuration = @{
            key = $controls.KeyBox.Text.Trim()
            workspace = $controls.WorkspaceBox.Text.Trim()
            model = 'claude-sonnet-5-5'
        }
        if ($Service -eq 'SerpAPI') { $configuration = @{ key = $controls.KeyBox.Text.Trim() } }
        Write-Host 'Validando e salvando a configuracao privada na VPS...'
        Send-LeadcapsPrivateConfiguration -Configuration $configuration -Destination $Destination -Service $Service
    } finally {
        $controls.KeyBox.Clear()
        $controls.Form.Dispose()
        if ($null -ne $configuration) { $configuration['key'] = $null }
    }
    Write-Host 'Carregando a configuracao somente na API do Leadcaps...'
    if ($Service -eq 'SerpAPI') {
        Invoke-LeadcapsSshCommand $Destination 'cd /opt/leadcaps && bash deploy/update-content.sh'
    } else {
        Invoke-LeadcapsSshCommand $Destination 'cd /opt/leadcaps && docker compose config --quiet && docker compose up -d --no-deps --force-recreate --wait --wait-timeout 150 api'
    }
    Write-Host 'Configuracao aplicada. Feche e reabra Inteligencia de conteudo no aplicativo.'
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Start-LeadcapsWindowsConfiguration -Destination $SshTarget -Service $Service }
    catch {
        Write-Host ('Configuracao interrompida: ' + $_.Exception.Message) -ForegroundColor Red
        exit 1
    }
}
