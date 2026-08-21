# Procedimento de Atualização — Máquina do Cliente (Windows, sem Docker)

Guia para aplicar uma nova versão do **Receivables Control System** em uma instalação já existente do cliente, rodando **Windows com PostgreSQL local (sem Docker)**. O objetivo é atualizar com **zero perda de dados**.

> Aplica-se a qualquer atualização que traga novas migrations Prisma (mudanças de schema, novas extensões, etc.). O exemplo usado é a versão que habilita a extensão `unaccent` para busca acento-insensível, mas os passos valem para qualquer release.

---

## Visão geral

```
 backup  →  pull  →  deps  →  migrate deploy  →  build frontend  →  restart  →  verificação
  (1)       (2)     (3)         (4)                 (5)              (6)          (7)
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

> **Dica:** Se o cliente tem rotina de backup, apenas confirme que o backup mais recente é da mesma data/hora e foi feito **antes** de iniciar a atualização.

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

Saída esperada:

```
3 migrations found in prisma/migrations
Applying migration 20260821180000_enable_unaccent_extension
All migrations have been successfully applied.
```

**O que esta migration faz**, no caso atual (Phase 59):

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

- ✅ Não altera tabelas.
- ✅ Não altera colunas.
- ✅ Não toca em dados de pessoas, pedidos, pagamentos, estoque, usuários, etc.
- ✅ É idempotente (`IF NOT EXISTS`): se a extensão já estiver habilitada, não faz nada.
- ⚠️ Requer que o usuário do banco (no exemplo, `admin`) tenha permissão para `CREATE EXTENSION`. No PostgreSQL instalado pelo instalador oficial, o usuário criado durante a instalação é superuser e tem essa permissão. Se o cliente usa um usuário com permissões reduzidas, pode ser necessário rodar a linha acima manualmente como superuser **uma única vez** (depois disso a extensão fica disponível para todos).

Caso precise habilitar manualmente:

```powershell
$env:PGPASSWORD = "senha_do_postgres"
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d receivables -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
```

---

## 6. Build do frontend

```powershell
cd C:\caminho\do\projeto\receivables-control\frontend
npm run build
```

Isso gera a pasta `frontend\dist\` com os arquivos estáticos. Se o cliente serve o frontend por um servidor (IIS, nginx no WSL, `serve`, etc.), copie o conteúdo de `dist\` para o local apropriado. Se o cliente usa `npm run dev` direto, pule esta etapa — apenas reinicie o backend.

---

## 7. Reiniciar o backend

Inicie o backend novamente (serviço do Windows, atalho ou `npm start` em produção):

```powershell
cd C:\caminho\do\projeto\receivables-control\backend
npm start
```

Verifique nos logs que o servidor subiu sem erros (`Server running on port 4000` ou similar).

---

## 8. Verificação pós-deploy

Faça uma checagem rápida:

1. **Acesse o frontend** no navegador (ex.: `http://localhost:3000`).
2. **Faça login** com um usuário existente.
3. **Teste a busca acento-insensível** (Phase 59):
   - Abra a tela de **Clientes**. Digite "cassia" e "Cássia" — ambos devem encontrar registros armazenados como "Cassia" e "Cássia".
   - Abra a tela de **Pedidos**. Pesquise por um Responsável com e sem acento — ambos devem retornar.
4. **Confirme que os dados continuam intactos**: contagem de clientes, pedidos, estoque não mudou.

---

## 9. Em caso de problema (rollback)

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
4. **Reinstale deps** e reinicie o backend.

> O backup em formato custom (`-F c`) preserva **todos os dados exatamente** como estavam no momento do `pg_dump`.

---

## Checklist rápido

```
[ ] 1. Backup do banco criado e verificado (tamanho > 0)
[ ] 2. Backend parado
[ ] 3. git pull sem conflitos
[ ] 4. npm install no backend e frontend
[ ] 5. npx prisma migrate deploy (NÃO usar migrate dev)
[ ] 6. npm run build no frontend (se aplicável)
[ ] 7. Backend reiniciado, logs sem erro
[ ] 8. Login + busca acento-insensível testadas
[ ] 9. Contagem de dados confere com a versão anterior
```

---

## Por que esta versão é segura

A única mudança no banco é:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

- A extensão `unaccent` é fornecida pelo próprio PostgreSQL (não é código nosso) e está disponível desde o PostgreSQL 10. A imagem `postgres:15-alpine` (e o instalador oficial para Windows) já a inclui — só precisa ser habilitada uma vez por banco.
- Nenhuma tabela, coluna ou linha de dados é tocada.
- Nenhuma migration destrutiva (`DROP`, `TRUNCATE`, `ALTER TABLE ... DROP COLUMN`) foi introduzida nesta versão.

Os DELETEs que você viu nos logs durante o desenvolvimento foram apenas comandos manuais de teste no banco Docker local do desenvolvedor — **não fazem parte da migration** e não rodam na máquina do cliente.
