# Bugs.md — Configuard

Análise realizada em 2026-06-05. Bugs e oportunidades de melhoria encontrados via inspeção estática do código.

---

## BACKEND

### CRÍTICO

#### B01 — SSH Host Key Verification desabilitado
- **Arquivo:** `backend/app/services/ssh_client.py` linhas 251–252
- **Categoria:** Segurança
- **Descrição:** Modo pexpect (fallback para dispositivos legacy) usa `StrictHostKeyChecking=no` e `UserKnownHostsFile=/dev/null`, permitindo ataque MITM em conexões SSH.
- **Fix:** Implementar known_hosts file ou key pinning em vez de desabilitar verificação.

#### B02 — TLS desabilitado no LDAP
- **Arquivo:** `backend/app/services/ldap_service.py` linha 83
- **Categoria:** Segurança
- **Descrição:** Conexões LDAP usam `ssl.CERT_NONE`, desabilitando validação de certificado. MITM na autenticação LDAP/AD é possível.
- **Fix:** Usar `ssl.CERT_REQUIRED` com validação de certificado.

#### B03 — LDAP Filter Injection
- **Arquivo:** `backend/app/services/ldap_service.py` linha 137
- **Categoria:** Segurança (Injeção)
- **Descrição:** Username é interpolado diretamente no filtro LDAP sem escape. Payload como `*)(uid=*))(|(uid=*` permite bypass de autenticação.
- **Fix:** Usar `ldap3.utils.escape_filter_chars(username)` antes da substituição.

---

### ALTO

#### B04 — Race condition no backup stream — lock liberado antes do thread terminar ✅
- **Arquivo:** `backend/app/api/routes/devices.py` linhas 657–701
- **Categoria:** Race Condition
- **Status:** Falso positivo confirmado. O lock e `thread_db.close()` já estão no bloco `finally` do thread `run_backup` (linha 696–698), não no gerador HTTP. O gerador apenas aguarda a fila. Comportamento já correto.

#### B05 — Leak de conexão SSH/Telnet no executor ✅

- **Arquivo:** `backend/app/services/backup_executor.py` linhas 383–615
- **Categoria:** Resource Leak
- **Correção:** `client = None` declarado antes do `try`. No `except`, `client.close()` chamado em bloco `try/except` próprio antes de processar o erro.

#### B06 — DB session não fechada no thread de stream ✅

- **Arquivo:** `backend/app/api/routes/devices.py` linhas 696–698
- **Categoria:** Resource Leak
- **Status:** Falso positivo confirmado. `thread_db.close()` e `backup_lock.release()` já estão no `finally` incondicional do thread `run_backup`. Comportamento já correto.

#### B07 — Scheduler sem rollback em falha de backup ✅

- **Arquivo:** `backend/app/services/scheduler.py` linha 114
- **Categoria:** Consistência de Dados
- **Correção:** Adicionado `db.rollback()` no bloco `except` de `_run_schedule()`, antes do log de erro, garantindo que a sessão seja limpa após falha de backup.

---

### MÉDIO

#### B08 — Validação de cron expression incompleta ✅

- **Arquivo:** `backend/app/services/scheduler.py` linhas 43–52
- **Categoria:** Validação
- **Correção:** Após dividir os 5 campos, a expressão é passada ao `CronTrigger` do APScheduler dentro de um `try/except`. Exceção relançada como `ValueError` com mensagem descritiva, rejeitando valores inválidos como `"99 99 99 99 99"` antes de registrar o job.

#### B09 — Derivação silenciosa da chave de criptografia ✅

- **Arquivo:** `backend/app/services/encryption.py` linhas 33–47
- **Categoria:** Segurança
- **Correção:** Removidos os caminhos alternativos (32 chars raw e SHA256 fallback). Agora exige exatamente 64 chars hexadecimais; qualquer outro formato lança `ValueError` com mensagem clara incluindo o comando para gerar uma chave válida.

#### B10 — SSH channel não fechado em timeout ✅

- **Arquivo:** `backend/app/services/ssh_client.py` linhas 448–490
- **Categoria:** Resource Leak
- **Correção:** Loop de recepção envolvido em `try/except TimeoutError`. Em caso de timeout, `self.channel.close()` é chamado antes de relançar a exceção.

#### B11 — SMTP connection não garantida em erro de `quit()` ✅

- **Arquivo:** `backend/app/services/email.py` linhas 154–166
- **Categoria:** Resource Leak
- **Correção:** `server.quit()` agora está em `try/except Exception: pass` dentro do `finally`, garantindo que falhas no encerramento da conexão não mascararam a exceção original.

---

## FRONTEND

### CRÍTICO

#### F01 — Tokens armazenados em localStorage ✅

- **Arquivo:** `frontend/src/services/api.ts`
- **Categoria:** Segurança
- **Correção:** Tokens migrados para `sessionStorage` (expiram ao fechar a aba). Removidas funções `getUserId`/`setUserId` e o header `X-User-Id` (cobre também F11). `API_BASE_URL` exportada como constante.

#### F02 — Redirect forçado no interceptor 401 ignora cleanup do React ✅

- **Arquivo:** `frontend/src/services/api.ts`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/App.tsx`
- **Categoria:** Bug / Segurança
- **Correção:** Interceptor emite `CustomEvent('auth:expired')` em vez de `window.location.href`. Flag `_authExpiredDispatched` evita disparos múltiplos por requests simultâneos. `AuthProvider` escuta o evento e chama `handleExpiredSession` (cleanup + `navigate('/auth')`). `BrowserRouter` movido para fora de `AuthProvider` para que `useNavigate` funcione dentro do provider.

---

### ALTO

#### F03 — Stale closure em `useInactivityTimeout` ✅

- **Arquivo:** `frontend/src/hooks/useInactivityTimeout.ts`
- **Categoria:** React Bug
- **Correção:** Adicionado `showWarningRef` (`useRef`) que espelha o estado `showWarning`. `handleActivity` lê `showWarningRef.current` em vez do estado capturado no closure, eliminando o stale closure. `resetTimer` e `startCountdown` mantêm o ref sincronizado.

#### F04 — Sem Error Boundary na árvore de componentes ✅

- **Arquivo:** `frontend/src/components/ErrorBoundary.tsx` (novo), `frontend/src/App.tsx`
- **Categoria:** Error Handling
- **Correção:** Criado componente `ErrorBoundary` (class component com `getDerivedStateFromError`) com tela de fallback e botão de reset. Envolve toda a árvore em `App.tsx`.

#### F05 — Atualização de estado em componente desmontado ✅

- **Arquivo:** `frontend/src/components/DeviceList.tsx`
- **Categoria:** Memory Leak / React Bug
- **Correção:** Adicionado `mountedRef` (`useRef(true)`) com cleanup no `useEffect`. Todos os callbacks `onSuccess`/`onError`/`onSettled` verificam `mountedRef.current` antes de atualizar estado.

#### F06 — Bulk delete em série sem tratamento de falha parcial ✅

- **Arquivo:** `frontend/src/components/DeviceList.tsx`
- **Categoria:** Bug
- **Correção:** `handleBulkDelete` substituído por `Promise.allSettled()`. Todas as deleções são tentadas em paralelo independentemente; contadores de sucesso/falha derivados dos resultados e exibidos em toasts separados.

---

### MÉDIO

#### F07 — `parseInt(formData.port)` sem validação ✅

- **Arquivo:** `frontend/src/components/DeviceList.tsx`
- **Categoria:** Bug / Validação
- **Correção:** `parseInt(..., 10)` com validação `isNaN || < 1 || > 65535` em `handleSubmit` e `handleEditSubmit`. Toast de erro antes de chamar `mutate` se inválido.

#### F08 — Inputs de login não desabilitados durante submit ✅

- **Arquivo:** `frontend/src/pages/Auth.tsx`
- **Categoria:** UX / Bug
- **Correção:** `disabled={loading}` adicionado nos campos de email e password. Botão de submit já tinha `disabled={loading}`.

#### F09 — Erros capturados com tipo `any` ✅

- **Arquivo:** `frontend/src/components/DeviceList.tsx`, `frontend/src/pages/Credentials.tsx`
- **Categoria:** TypeScript
- **Correção:** `error: any` substituído por `error: unknown` com `getErrorMessage(error)` da `api.ts` em todos os callbacks `onError` de `DeviceList` e `Credentials`.

#### F10 — Dados sensíveis não limpos após submit em Credentials ✅

- **Arquivo:** `frontend/src/pages/Credentials.tsx`
- **Categoria:** Segurança
- **Status:** Já correto. `closeDialog()` chama `resetForm()` que zera `password`, `private_key` e `passphrase` para `""` em todo fluxo de sucesso (create e update).

#### F11 — User ID armazenado em localStorage e enviado como header customizado ✅

- **Arquivo:** `frontend/src/services/api.ts`, `frontend/src/services/auth.ts`
- **Categoria:** Segurança / Design
- **Correção:** Coberto junto com F01. Funções `getUserId`/`setUserId`/`clearUserId` removidas. Header `X-User-Id` eliminado do interceptor de request. Referência em `auth.ts` removida.

#### F12 — URL base da API construída inline no EventSource ✅

- **Arquivo:** `frontend/src/pages/DeviceLogs.tsx`
- **Categoria:** Manutenibilidade
- **Correção:** `API_BASE_URL` exportada de `api.ts` e usada diretamente em `DeviceLogs.tsx`, eliminando a duplicação do fallback inline.

---

## RESUMO

| ID | Severidade | Área | Título |
|----|-----------|------|--------|
| B01 | Crítico | Backend | SSH Host Key Verification desabilitado |
| B02 | Crítico | Backend | TLS desabilitado no LDAP |
| B03 | Crítico | Backend | LDAP Filter Injection |
| B04 | Alto | Backend | Race condition no backup stream — ✅ falso positivo |
| B05 | Alto | Backend | Leak de conexão SSH/Telnet — ✅ corrigido |
| B06 | Alto | Backend | DB session não fechada no thread de stream — ✅ falso positivo |
| B07 | Alto | Backend | Scheduler sem rollback em falha — ✅ corrigido |
| B08 | Médio | Backend | Validação de cron incompleta — ✅ corrigido |
| B09 | Médio | Backend | Derivação silenciosa de chave de criptografia — ✅ corrigido |
| B10 | Médio | Backend | SSH channel não fechado em timeout — ✅ corrigido |
| B11 | Médio | Backend | SMTP connection não garantida em erro — ✅ corrigido |
| F01 | Crítico | Frontend | Tokens em localStorage — ✅ corrigido (sessionStorage) |
| F02 | Crítico | Frontend | Redirect 401 ignora cleanup do React — ✅ corrigido |
| F03 | Alto | Frontend | Stale closure em useInactivityTimeout — ✅ corrigido |
| F04 | Alto | Frontend | Sem Error Boundary — ✅ corrigido |
| F05 | Alto | Frontend | State update em componente desmontado — ✅ corrigido |
| F06 | Alto | Frontend | Bulk delete sem tratamento de falha parcial — ✅ corrigido |
| F07 | Médio | Frontend | parseInt sem validação de porta — ✅ corrigido |
| F08 | Médio | Frontend | Inputs não desabilitados durante submit — ✅ corrigido |
| F09 | Médio | Frontend | Erros tipados como any — ✅ corrigido |
| F10 | Médio | Frontend | Dados sensíveis não limpos após submit — ✅ falso positivo |
| F11 | Médio | Frontend | X-User-Id header manipulável — ✅ corrigido |
| F12 | Baixo | Frontend | URL do EventSource construída inline — ✅ corrigido |
