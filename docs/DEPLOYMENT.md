# Procedimento de Atualização — Máquina do Cliente (Windows, sem Docker)

Guia para aplicar uma nova versão do **Receivables Control System** em uma instalação já existente do cliente, rodando **Windows com PostgreSQL local (sem Docker)**. O objetivo é atualizar com **zero perda de dados**.

Use este roteiro toda vez que uma nova versão trouxer migrations Prisma (mudanças de schema, novas extensões, novos índices, etc.) ou alterações de código/dependências que precisem chegar ao cliente.

---

## Visão geral

```
 backup  →  parar backend  →  pull  →  deps  →  migrate deploy  →  prisma generate  →  build frontend  →  reiniciar  →  verificação
  (1)            (2)          (3)     (4)         (5)                  (6)               (7)             (8)           (9)
```

Cada etapa é descrita em detalhe abaixo. **Não pule o backup.** Se algo falhar no meio, o backup é a sua rede de segurança.

---

## 1. Backup do banco de dados (obrigatório, antes de tudo)

Faça backup completo do banco `receivables` com `pg_dump`. O arquivo gerado contém **todos os dados**: pessoas, pedidos, pagamentos, estoque, usuários, etc.

Abra o **PowerShell** e execute:

```powershell
# Ajuste usuario/banco se forem diferentes no cliente
$env:PGPASSWORD = "admin"
& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
  -h localhost -p 5432 -U admin -d receivables `
  -F c -b -v `
  -f "C:\backups\receivables-backup-AAAA-MM-DD.backup"
```

- `-F c` = formato custom (compactado). Pode ser restaurado com `pg_restore`.
- `-b` = inclui blobs.
- `-v` = verbose (opcional, mostra o progresso).

Verifique que o arquivo `.backup` foi criado e tem tamanho razoável (não deve ser 0 bytes):

```powershell
Get-Item "C:\backups\receivables-backup-AAAA-MM-DD.backup" | Select-Object Name, Length
```

> **Dica:** Se o cliente já tem rotina de backup, apenas confirme que o backup mais recente é da mesma data/hora e foi feito **antes** de iniciar a atualização.

---

## 2. Parar o backend em execução

Se o backend está rodando como serviço do Windows ou em um terminal, **pare-o agora**. Se for um atalho `.bat` ou `node src/server.js`, feche o terminal/serviço.

> Por que parar? Para que nenhuma requisição seja processada enquanto o schema está sendo migrado.

---

## 3. Atualizar o código-fonte

Vá até a pasta do projeto e puxe a nova versão:

```powershell
cd C:\caminho\do\projeto\receivables-control
git pull
```

Se houver conflitos locais (cliente editou algo), resolva antes de prosseguir.

---

## 4. Instalar/atualizar dependências

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

O `npm install` do backend dispara automaticamente `prisma generate` via `postinstall`, mas isso será reforçado na etapa 6 abaixo para garantir.

---

## 5. Aplicar as migrations com segurança

**Esta é a etapa crítica.** Em bancos com dados **nunca** use `prisma migrate dev`. Use **`prisma migrate deploy`**, que apenas aplica migrations novas sem nunca regerar nem resetar o schema.

```powershell
cd C:\caminho\do\projeto\receivables-control\backend

# Garanta que o .env aponta para o banco local (host = localhost)
# Em Windows sem Docker, a DATABASE_URL deve ser:
# postgresql://admin:admin@localhost:5432/receivables?schema=public

npx prisma migrate deploy
```

Saída esperada (exemplo com uma migration nova):

```
3 migrations found in prisma/migrations
Applying migration 2026XXXXXXXXXX_nome_da_migration
All migrations have been successfully applied.
```

> **Sobre o usuário do banco:** as migrations aplicadas precisam de permissões para criar/alterar objetos no schema. Em geral, o usuário criado durante a instalação do PostgreSQL é superuser e tem todas as permissões. Se o cliente usa um usuário com permissões reduzidas, ele deve conseguir pelo menos executar as migrations da nova versão — caso contrário, conecte-se como superuser (ex.: `postgres`) **uma única vez** e aplique manualmente as instruções da migration (o arquivo está em `backend/prisma/migrations/<id>/migration.sql`).

---

## 6. Regenerar o Prisma Client

Após aplicar as migrations, regenere o Prisma Client para garantir que o código do backend esteja 100% em sincronia com o schema do banco:

```powershell
cd C:\caminho\do\projeto\receivables-control\backend
npx prisma generate
```

Esse passo é idempotente e seguro. Ele é importante porque:

- Novas migrations podem ter introduzido colunas, tabelas ou tipos que o client precisa conhecer.
- Garante que o binário do client em `node_modules/.prisma/client` bate com o `schema.prisma`.
- O `npm install` (etapa 4) já chama `prisma generate` via `postinstall`, mas rodar de novo aqui é uma rede de segurança contra qualquer dessincronia.

> ⚠️ **Windows — problema conhecido (EPERM no `query_engine-windows.dll.node`).**
> No Windows, `prisma generate` faz um `rename` atômico sobre o DLL do engine (`node_modules\.prisma\client\query_engine-windows.dll.node`). Se esse DLL estiver aberto em modo exclusivo por outro processo, o comando falha com:
>
> ```
> EPERM: operation not permitted, rename '...\query_engine-windows.dll.node.tmpXXXX' ->
>                                   '...\query_engine-windows.dll.node'
> ```
>
> Os culpados mais comuns são: (a) **o próprio backend Node ainda em execução** (fechar a janela do PowerShell **não** garante que `node.exe` morra), (b) o **VS Code** com o projeto aberto (o TypeScript Language Server carrega o client), ou (c) o **Windows Defender** escaneando o arquivo em tempo real.
>
> **Correção** (nesta ordem):
>
> ```powershell
> # 1) Mate qualquer node.exe remanescente
> Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
>
> # 2) Feche o VS Code (ou Ctrl+Shift+P -> "Reload Window")
>
> # 3) Apague a pasta .prisma para forçar uma regeneração limpa
> Remove-Item -Recurse -Force ".\node_modules\.prisma\client"
>
> # 4) Regenere
> npx prisma generate
> ```
>
> Se ainda falhar, adicione uma exclusão no Windows Defender para `node_modules\.prisma`:
>
> ```powershell
> Add-MpPreference -ExclusionPath "C:\caminho\do\projeto\receivables-control\backend\node_modules\.prisma"
> ```
>
> Em seguida repita os passos 3 e 4. Esse comportamento é exclusivo do Windows e não acontece no Linux/macOS.

---

## 7. Build do frontend

```powershell
cd C:\caminho\do\projeto\receivables-control\frontend
npm run build
```

Isso gera a pasta `frontend\dist\` com os arquivos estáticos. Se o cliente serve o frontend por um servidor (IIS, nginx no WSL, `serve`, etc.), copie o conteúdo de `dist\` para o local apropriado. Se o cliente usa `npm run dev` direto, pule esta etapa — apenas reinicie o backend.

---

## 8. Reiniciar o backend

Inicie o backend novamente (serviço do Windows, atalho ou `npm start` em produção):

```powershell
cd C:\caminho\do\projeto\receivables-control\backend
npm start
```

Verifique nos logs que o servidor subiu sem erros (`Server running on port 4000` ou similar).

---

## 9. Verificação pós-deploy

Faça uma checagem rápida:

1. **Acesse o frontend** no navegador (ex.: `http://localhost:3000`).
2. **Faça login** com um usuário existente.
3. **Teste as funcionalidades alteradas nesta versão** (consulte o `CHANGELOG.md` da release).
4. **Confirme que os dados continuam intactos**: contagem de clientes, pedidos, estoque não mudou em relação à versão anterior.

---

## 10. Em caso de problema (rollback)

Se algo deu errado e o cliente precisa voltar à versão anterior imediatamente:

1. **Pare o backend** (etapa 2).
2. **Restaure o backup** feito na etapa 1:

   ```powershell
   $env:PGPASSWORD = "admin"
   & "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe" `
     -h localhost -p 5432 -U admin -d receivables `
     --clean --if-exists --verbose `
     "C:\backups\receivables-backup-AAAA-MM-DD.backup"
   ```

   `--clean --if-exists` remove objetos que serão recriados, evitando conflitos.

3. **Volte o código** para a versão anterior: `git checkout <tag-ou-commit-anterior>`.
4. **Reinstale deps** (`npm install` no backend e frontend) e reinicie o backend.

> O backup em formato custom (`-F c`) preserva **todos os dados exatamente** como estavam no momento do `pg_dump`.

---

## Checklist rápido

```
[ ] 1. Backup do banco criado e verificado (tamanho > 0)
[ ] 2. Backend parado
[ ] 3. git pull sem conflitos
[ ] 4. npm install no backend e frontend
[ ] 5. npx prisma migrate deploy (NÃO usar migrate dev)
[ ] 6. npx prisma generate no backend
[ ] 7. npm run build no frontend (se aplicável)
[ ] 8. Backend reiniciado, logs sem erro
[ ] 9. Login + funcionalidades da versão testadas
[ ] 10. Contagem de dados confere com a versão anterior
```
