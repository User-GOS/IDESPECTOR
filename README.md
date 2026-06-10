# IDespector

Painel pessoal de produtividade — tarefas, lembretes, alarmes, agenda, notas e assistente IA local. Tudo em um único arquivo HTML, com servidor local em PowerShell.

![IDespector](https://img.shields.io/badge/versão-29--outlook--v1-6366f1)
![Plataforma](https://img.shields.io/badge/plataforma-Windows-0078D4)
![Licença](https://img.shields.io/badge/licença-MIT-green)

## Funcionalidades

- **Dashboard** — visão do dia com métricas, relógio ao vivo e widgets
- **Tarefas** — CRUD, prioridade, categorias, prazos e filtros
- **Agenda** — compromissos do dia com edição inline
- **Lembretes e alarmes** — notificações visuais, sonoras e por toast
- **Bloco de notas** — auto-save local
- **Assistente IA** — comandos em português (processamento local, sem API externa)
- **Modo Foco** — overlay de concentração
- **Integrações**
  - Telegram (notificações via bot)
  - WhatsApp (CallMeBot)
  - LinkedIn (atalho de perfil)
  - **Outlook Web** — sincronização Microsoft Graph + importação ICS

## Requisitos

- Windows 10/11
- PowerShell 5.1+
- Navegador moderno (Chrome, Edge ou Firefox)
- [Git](https://git-scm.com/download/win) (apenas para clonar/publicar)

## Início rápido

```bat
# 1. Clone o repositório
git clone https://github.com/User-GOS/IDESPECTOR.git
cd IDESPECTOR

# 2. Inicie o servidor
iniciar.bat
```

O app abre em: **http://localhost:8772/idespector.html**

## Estrutura do projeto

```
IDESPECTOR/
├── idespector.html   # App completa (HTML + CSS + JS)
├── server.ps1        # Servidor local + APIs (WhatsApp, Telegram, Outlook ICS)
├── iniciar.bat       # Atalho para subir o servidor
├── publicar-github.ps1
├── README.md
└── LICENSE
```

## Servidor local (porta 8772)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/idespector.html` | GET | Aplicação principal |
| `/api/health` | GET | Status do servidor |
| `/api/whatsapp` | POST | Envio via CallMeBot |
| `/api/telegram/send` | POST | Envio de mensagem Telegram |
| `/api/telegram/validate` | POST | Valida token do bot |
| `/api/telegram/chatid` | POST | Detecta Chat ID |
| `/api/outlook/ics` | POST | Proxy para importar calendário ICS |

## Outlook Web

1. Duplo clique no pill **Outlook** no header
2. **Opção A — Microsoft Graph (completa):** registre um app no [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), adicione redirect URI `http://localhost:8772/idespector.html` e permissões `Calendars.ReadWrite` + `User.Read`
3. **Opção B — ICS (simples):** publique o calendário no Outlook Web e cole o link ICS nas configurações

## Telegram

1. Crie um bot com [@BotFather](https://t.me/BotFather)
2. No IDespector: pill **Telegram** → cole o token → envie `/start` ao bot → conectar

## WhatsApp (CallMeBot)

1. Pill **WhatsApp** → siga o fluxo de ativação com o CallMeBot
2. Use a API Key real recebida no WhatsApp (não use chaves de exemplo)

## Atalhos de teclado

| Atalho | Ação |
|--------|------|
| `Alt+T` | Nova tarefa |
| `Alt+R` | Novo lembrete |
| `Alt+A` | Novo alarme |
| `Alt+F` | Modo Foco |
| `Esc` | Fechar modal / sair do foco |

## Dados e privacidade

Todos os dados (tarefas, notas, chat, tokens) ficam no **localStorage** do seu navegador. Nada é enviado a servidores externos, exceto quando você ativa integrações (Telegram, WhatsApp, Microsoft Graph).

## Publicar alterações no GitHub

```powershell
.\publicar-github.ps1
```

Ou manualmente:

```bash
git add .
git commit -m "sua mensagem"
git push
```

## Licença

MIT — veja [LICENSE](LICENSE).
