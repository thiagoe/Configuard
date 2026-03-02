import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Database, 
  Shield, 
  Server, 
  Users, 
  FileCode, 
  Layers, 
  Network, 
  Key,
  Clock,
  GitBranch,
  BookOpen,
  Cpu,
  HardDrive,
  Lock,
  Workflow,
  FolderTree,
  MessageSquare,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const AboutProject = () => {
  const [copied, setCopied] = useState(false);

  const basePrompt = `# Configuard - Prompt para Criação do Sistema

## Visão Geral do Projeto

Crie um sistema web chamado "Configuard" para gerenciamento centralizado de configurações de dispositivos de rede (roteadores, switches, firewalls). O sistema deve permitir:

1. **Backup automatizado** de configurações via SSH/Telnet
2. **Versionamento** de configurações com histórico completo
3. **Comparação de versões** (diff) para identificar mudanças
4. **Gerenciamento de credenciais** criptografadas
5. **Organização** por marcas e categorias
6. **Templates de backup** flexíveis e reutilizáveis
7. **Auditoria** completa de todas as ações
8. **Sistema de roles** (admin, moderator, user)

---

## Stack Tecnológica

### Frontend
- React 18 com TypeScript
- Vite como bundler
- Tailwind CSS para estilização
- shadcn/ui para componentes (baseado em Radix UI)
- React Router para navegação
- React Query (@tanstack/react-query) para gerenciamento de estado/cache
- Recharts para gráficos
- Lucide React para ícones
- Sonner para notificações toast
- date-fns para manipulação de datas

### Backend
- Node.js com Express ou NestJS
- MySQL 8.0+ como banco de dados
- Prisma ORM ou TypeORM para acesso ao banco
- JWT para autenticação
- bcrypt para hash de senhas
- API RESTful ou GraphQL

---

## Estrutura do Banco de Dados (MySQL)

### Tabela: app_roles (Enum simulado)
\`\`\`sql
-- MySQL não suporta ENUM como tipo separado, usar VARCHAR com CHECK ou tabela lookup
-- Valores permitidos: 'admin', 'moderator', 'user'
\`\`\`


### Tabela: users
\`\`\`sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  email_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: user_roles
\`\`\`sql
CREATE TABLE user_roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'moderator', 'user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_roles_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_roles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- IMPORTANTE: Roles NUNCA devem ser armazenadas no localStorage ou na tabela users
\`\`\`

### Tabela: credentials
\`\`\`sql
CREATE TABLE credentials (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  username VARCHAR(255) NOT NULL,
  encrypted_password TEXT NOT NULL, -- Criptografado com AES-256-GCM
  ssh_key TEXT, -- Chave SSH opcional, também criptografada
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_credentials_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: brands
\`\`\`sql
CREATE TABLE brands (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_brands_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: backup_templates
\`\`\`sql
CREATE TABLE backup_templates (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  commands TEXT NOT NULL, -- Comandos separados por \\n
  use_steps BOOLEAN DEFAULT FALSE, -- Usar editor de passos avançado
  -- Configurações de Prompt
  prompt_pattern VARCHAR(255) DEFAULT '#|>|$',
  login_prompt VARCHAR(255) DEFAULT 'Username:|Login:',
  password_prompt VARCHAR(255) DEFAULT 'Password:',
  enable_prompt VARCHAR(255),
  enable_password_required BOOLEAN DEFAULT FALSE,
  -- Paginação
  pagination_pattern VARCHAR(255) DEFAULT '--More--|<--- More --->',
  pagination_key VARCHAR(10) DEFAULT ' ',
  -- Timeouts
  connection_timeout INT DEFAULT 30,
  command_timeout INT DEFAULT 60,
  -- Comandos Extras
  pre_commands TEXT,
  post_commands TEXT,
  error_patterns TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_backup_templates_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: template_steps
\`\`\`sql
CREATE TABLE template_steps (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  template_id CHAR(36) NOT NULL,
  step_order INT NOT NULL DEFAULT 0,
  step_type ENUM('command', 'expect', 'pause', 'set_prompt', 'enter_mode') NOT NULL DEFAULT 'command',
  command TEXT,
  expect_pattern VARCHAR(255),
  timeout_seconds INT DEFAULT 30,
  delay_ms INT DEFAULT 0,
  capture_output BOOLEAN DEFAULT TRUE,
  on_error ENUM('continue', 'stop', 'retry') DEFAULT 'continue',
  retry_count INT DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES backup_templates(id) ON DELETE CASCADE,
  INDEX idx_template_steps_template (template_id),
  INDEX idx_template_steps_order (template_id, step_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: categories
\`\`\`sql
CREATE TABLE categories (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_categories_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: devices
\`\`\`sql
CREATE TABLE devices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  ip_address VARCHAR(45) NOT NULL, -- Suporta IPv6
  port INT DEFAULT 22,
  brand_id CHAR(36),
  category_id CHAR(36),
  credential_id CHAR(36),
  encrypted_credentials TEXT NOT NULL, -- Deprecated, usar credential_id
  backup_enabled BOOLEAN DEFAULT TRUE,
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  notes TEXT,
  last_backup_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL,
  INDEX idx_devices_user (user_id),
  INDEX idx_devices_status (status),
  INDEX idx_devices_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: configurations
\`\`\`sql
CREATE TABLE configurations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  device_id CHAR(36) NOT NULL,
  version INT NOT NULL, -- Auto-incrementado por device via trigger
  config_data LONGTEXT NOT NULL, -- Conteúdo da configuração
  config_hash VARCHAR(64) NOT NULL, -- Hash SHA-256 para detectar mudanças
  changes_detected BOOLEAN DEFAULT FALSE,
  diff_summary JSON,
  collection_method ENUM('manual', 'scheduled', 'api') DEFAULT 'manual',
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_configurations_device (device_id),
  INDEX idx_configurations_version (device_id, version),
  INDEX idx_configurations_collected (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: audit_logs
\`\`\`sql
CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, LOGIN, etc
  table_name VARCHAR(100),
  record_id CHAR(36),
  old_data JSON,
  new_data JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_table (table_name),
  INDEX idx_audit_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

### Tabela: refresh_tokens (para autenticação JWT)
\`\`\`sql
CREATE TABLE refresh_tokens (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_tokens_user (user_id),
  INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\`\`\`

---

## Stored Procedures e Funções MySQL

### Verificação de Role
\`\`\`sql
DELIMITER //

CREATE FUNCTION has_role(p_user_id CHAR(36), p_role VARCHAR(20))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE result BOOLEAN DEFAULT FALSE;
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id AND role = p_role
  ) INTO result;
  RETURN result;
END //

CREATE FUNCTION is_admin(p_user_id CHAR(36))
RETURNS BOOLEAN
DETERMINISTIC
READS SQL DATA
BEGIN
  RETURN has_role(p_user_id, 'admin');
END //

DELIMITER ;
\`\`\`

### Auto-incremento de Versão por Dispositivo
\`\`\`sql
DELIMITER //

CREATE FUNCTION get_latest_version(p_device_id CHAR(36))
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE latest INT DEFAULT 0;
  SELECT COALESCE(MAX(version), 0) INTO latest
  FROM configurations WHERE device_id = p_device_id;
  RETURN latest;
END //

-- Trigger para auto-incrementar versão
CREATE TRIGGER before_configuration_insert
BEFORE INSERT ON configurations
FOR EACH ROW
BEGIN
  SET NEW.version = get_latest_version(NEW.device_id) + 1;
END //

DELIMITER ;
\`\`\`

### Trigger para Auditoria
\`\`\`sql
DELIMITER //

CREATE PROCEDURE log_audit(
  IN p_user_id CHAR(36),
  IN p_action VARCHAR(50),
  IN p_table_name VARCHAR(100),
  IN p_record_id CHAR(36),
  IN p_old_data JSON,
  IN p_new_data JSON,
  IN p_ip_address VARCHAR(45),
  IN p_user_agent TEXT
)
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_data, p_new_data, p_ip_address, p_user_agent);
END //

DELIMITER ;
\`\`\`

---

## Middleware de Autorização (Backend Node.js)

### Verificação de JWT
\`\`\`typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken';

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};
\`\`\`

### Verificação de Admin
\`\`\`typescript
// middleware/adminOnly.ts
export const adminOnlyMiddleware = async (req, res, next) => {
  const [rows] = await db.query(
    'SELECT is_admin(?) as isAdmin',
    [req.userId]
  );
  
  if (!rows[0].isAdmin) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};
\`\`\`

### Verificação de Propriedade (Owner Check)
\`\`\`typescript
// middleware/ownerCheck.ts
export const ownerCheckMiddleware = (tableName: string) => {
  return async (req, res, next) => {
    const recordId = req.params.id;
    const [rows] = await db.query(
      \`SELECT user_id FROM \${tableName} WHERE id = ?\`,
      [recordId]
    );
    
    if (!rows.length || rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};
\`\`\`

---

## Páginas do Sistema

1. **/** - Página inicial (redirect para dashboard se autenticado)
2. **/auth** - Login e registro
3. **/dashboard** - Dashboard com resumo geral
4. **/devices** - Lista de dispositivos com CRUD
5. **/devices/:id** - Detalhes do dispositivo
6. **/devices/:id/history** - Histórico de backups do dispositivo
7. **/backups** - Lista de todos os backups
8. **/backup-templates** - Gerenciamento de templates
9. **/brands** - Gerenciamento de marcas
10. **/categories** - Gerenciamento de categorias
11. **/schedules** - Agendamentos de backup
12. **/versions** - Comparação de versões
13. **/diff** - Visualização de diff entre configs
14. **/search** - Busca em configurações
15. **/audit** - Logs de auditoria
16. **/admin** - Painel administrativo (apenas admins)
    - Gerenciamento de usuários
    - Credenciais
    - Estatísticas do banco
    - Logs de auditoria
    - Configurações de segurança
    - Configurações do sistema
    - Documentação (Sobre)

---

## Segurança - Requisitos Críticos

1. **Criptografia de Credenciais**: Use AES-256-GCM com IV único
   - Formato: \`v1:aes256gcm:<base64_encrypted>\`
   - Derivação de chave com PBKDF2

2. **Hash de Senhas**: Use bcrypt com salt rounds >= 12

3. **Roles em Tabela Separada**: NUNCA armazenar roles em users ou localStorage

4. **JWT com Refresh Token**: Access token curto (15min), refresh token longo (7 dias)

5. **Middleware de Autorização**: Verificar ownership em todas as rotas sensíveis

6. **Auditoria**: Registrar todas as ações críticas em audit_logs

7. **Rate Limiting**: Implementar rate limiting em endpoints de autenticação

8. **SQL Injection**: Usar prepared statements/parameterized queries SEMPRE

9. **CORS**: Configurar CORS restritivo em produção

## Componentes Principais

- **LayoutWrapper**: Layout com sidebar usando shadcn/ui Sidebar
- **AppSidebar**: Menu lateral com navegação
- **DeviceList**: Lista de dispositivos com filtros
- **ConfigDiffViewer**: Comparador de configurações lado a lado
- **TemplateStepEditor**: Editor de passos para templates avançados
- **TemplateAdvancedSettings**: Configurações avançadas de template

---

## Exportação/Importação de Templates

O sistema permite exportar e importar templates de backup em formato JSON.

### Funcionalidades de Export/Import
- **Exportar Individual**: Ícone download na linha do template
- **Exportar Todos**: Botão "Exportar Todos" no cabeçalho da página
- **Importar**: Botão "Importar" aceita arquivos .json (individual ou múltiplos)
- **Steps Inclusos**: Steps são exportados/importados junto com o template
- **Formato JSON**: Inclui versão, timestamp, configurações e steps

---

## API Endpoints (REST)

### Autenticação
\`\`\`
POST /api/auth/register     - Registro de usuário
POST /api/auth/login        - Login (retorna access + refresh token)
POST /api/auth/refresh      - Renovar access token
POST /api/auth/logout       - Invalidar refresh token
\`\`\`

### Usuários
\`\`\`
GET    /api/users/me        - Perfil do usuário logado
PUT    /api/users/me        - Atualizar perfil
GET    /api/admin/users     - Listar usuários (admin only)
PUT    /api/admin/users/:id - Atualizar role (admin only)
\`\`\`

### Recursos (CRUD padrão para cada entidade)
\`\`\`
GET    /api/devices         - Listar dispositivos do usuário
POST   /api/devices         - Criar dispositivo
GET    /api/devices/:id     - Obter dispositivo
PUT    /api/devices/:id     - Atualizar dispositivo
DELETE /api/devices/:id     - Remover dispositivo

# Mesmo padrão para: templates, credentials, brands, categories
\`\`\`

### Configurações
\`\`\`
GET    /api/devices/:id/configurations    - Histórico de configs
POST   /api/devices/:id/backup            - Executar backup manual
GET    /api/configurations/:id/diff/:id2  - Comparar duas versões
GET    /api/search?q=termo                - Buscar em configurações
\`\`\`

---

## Estilo e UI

- Tema escuro/claro com next-themes
- Design responsivo (mobile-first)
- Cores via CSS variables (HSL)
- Componentes shadcn/ui customizados
- Ícones Lucide React
- Animações com tailwindcss-animate

---

## Variáveis de Ambiente

\`\`\`env
# Database
DATABASE_URL=mysql://user:password@host:3306/netconfig_manager
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=netconfig
DATABASE_PASSWORD=secure_password
DATABASE_NAME=netconfig_manager

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
\`\`\`

---

## Observações Finais

1. Use React Query para todas as operações de dados no frontend
2. Configure connection pooling no MySQL (mysql2/promise ou Prisma)
3. Implemente transactions para operações que afetam múltiplas tabelas
4. Use prepared statements para prevenir SQL Injection
5. Implemente loading states e tratamento de erros
6. Use toast (Sonner) para feedback ao usuário
7. Mantenha componentes pequenos e focados
8. Siga o padrão de design system com tokens CSS
9. Configure backups automáticos do banco MySQL
10. Use migrations (Prisma Migrate ou Knex) para versionamento do schema`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(basePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Configuard - Documentação do Projeto
          </CardTitle>
          <CardDescription>
            Sistema de gerenciamento de configurações de dispositivos de rede com backup automatizado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="database">Banco de Dados</TabsTrigger>
              <TabsTrigger value="architecture">Arquitetura</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="features">Funcionalidades</TabsTrigger>
              <TabsTrigger value="tech">Tecnologias</TabsTrigger>
              <TabsTrigger value="prompt">Prompt Base</TabsTrigger>
            </TabsList>

            {/* VISÃO GERAL */}
            <TabsContent value="overview" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Network className="h-5 w-5 text-primary" />
                      O que é o Configuard?
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      O Configuard é uma aplicação web para gerenciamento centralizado de configurações 
                      de dispositivos de rede (roteadores, switches, firewalls). Permite realizar backups 
                      automatizados, comparar versões de configuração, gerenciar credenciais de acesso e 
                      manter um histórico completo de alterações.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Workflow className="h-5 w-5 text-primary" />
                      Fluxo Principal de Uso
                    </h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li><strong>Cadastrar Credenciais:</strong> Criar credenciais SSH/Telnet para acesso aos dispositivos</li>
                      <li><strong>Cadastrar Marcas/Categorias:</strong> Organizar dispositivos por fabricante e tipo</li>
                      <li><strong>Criar Templates de Backup:</strong> Definir comandos e sequência para coleta de configuração</li>
                      <li><strong>Cadastrar Dispositivos:</strong> Registrar switches, roteadores, firewalls com IP, porta e credencial</li>
                      <li><strong>Executar Backups:</strong> Coletar configurações manualmente ou via agendamento</li>
                      <li><strong>Comparar Versões:</strong> Visualizar diferenças entre configurações ao longo do tempo</li>
                      <li><strong>Auditoria:</strong> Monitorar todas as ações realizadas no sistema</li>
                    </ol>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Users className="h-5 w-5 text-primary" />
                      Tipos de Usuário
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge variant="destructive">Admin</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Acesso total ao sistema. Pode gerenciar usuários, roles, ver logs de auditoria 
                          e acessar todas as funcionalidades administrativas.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge variant="secondary">Moderator</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Pode gerenciar dispositivos, templates e backups. Acesso limitado às 
                          configurações administrativas.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge variant="outline">User</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Acesso básico para visualizar dispositivos e configurações. Pode executar 
                          backups manuais dos seus dispositivos.
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Cpu className="h-5 w-5 text-primary" />
                      Sistemas Operacionais Suportados
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Cisco IOS</Badge>
                      <Badge>Cisco NX-OS</Badge>
                      <Badge>Juniper JunOS</Badge>
                      <Badge>Arista EOS</Badge>
                      <Badge>MikroTik RouterOS</Badge>
                      <Badge>Fortinet FortiOS</Badge>
                      <Badge>Palo Alto PAN-OS</Badge>
                      <Badge variant="outline">Outros</Badge>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* BANCO DE DADOS */}
            <TabsContent value="database" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Database className="h-5 w-5 text-primary" />
                      Estrutura de Tabelas
                    </h3>
                    
                    <div className="space-y-4">
                      {/* profiles */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">profiles</CardTitle>
                          <CardDescription>Perfis de usuários sincronizados com auth.users</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id          UUID (PK, FK → auth.users)
email       TEXT
full_name   TEXT
avatar_url  TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* user_roles */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">user_roles</CardTitle>
                          <CardDescription>Roles de usuários (admin, moderator, user)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id          UUID (PK)
user_id     UUID (FK → auth.users, UNIQUE)
role        app_role ENUM ('admin', 'moderator', 'user')
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* credentials */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">credentials</CardTitle>
                          <CardDescription>Credenciais de acesso SSH/Telnet criptografadas</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id                  UUID (PK)
user_id             UUID (FK → auth.users)
name                TEXT (nome identificador)
description         TEXT
username            TEXT
encrypted_password  TEXT (AES-256-GCM)
ssh_key             TEXT (chave privada opcional)
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* brands */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">brands</CardTitle>
                          <CardDescription>Fabricantes de equipamentos (Cisco, Juniper, etc)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id          UUID (PK)
user_id     UUID (FK → auth.users)
name        TEXT
description TEXT
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* categories */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">categories</CardTitle>
                          <CardDescription>Categorias de dispositivos (Router, Switch, Firewall)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id                  UUID (PK)
user_id             UUID (FK → auth.users)
name                TEXT
description         TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* backup_templates */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">backup_templates</CardTitle>
                          <CardDescription>Templates de backup com comandos e configurações</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id                       UUID (PK)
user_id                  UUID (FK → auth.users)
name                     TEXT
description              TEXT
commands                 TEXT (comandos separados por \\n)
use_steps                BOOLEAN (usar editor de passos)
-- Configurações de Prompt --
prompt_pattern           TEXT (regex: '#|>|$')
login_prompt             TEXT ('Username:|Login:')
password_prompt          TEXT ('Password:')
enable_prompt            TEXT
enable_password_required BOOLEAN
-- Paginação --
pagination_pattern       TEXT ('--More--|<--- More --->')
pagination_key           TEXT (' ')
-- Timeouts --
connection_timeout       INTEGER (segundos)
command_timeout          INTEGER (segundos)
-- Comandos Extras --
pre_commands             TEXT (antes do backup)
post_commands            TEXT (após o backup)
error_patterns           TEXT (padrões de erro)
created_at               TIMESTAMPTZ
updated_at               TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* template_steps */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">template_steps</CardTitle>
                          <CardDescription>Passos individuais de um template (modo avançado)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id              UUID (PK)
template_id     UUID (FK → backup_templates)
step_order      INTEGER (ordem de execução)
step_type       TEXT ('command', 'expect', 'pause', 'set_prompt', 'enter_mode')
command         TEXT
expect_pattern  TEXT (regex esperado)
timeout_seconds INTEGER
delay_ms        INTEGER (pausa após comando)
capture_output  BOOLEAN
on_error        TEXT ('continue', 'stop', 'retry')
retry_count     INTEGER
enabled         BOOLEAN
description     TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* devices */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">devices</CardTitle>
                          <CardDescription>Dispositivos de rede cadastrados</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id                     UUID (PK)
user_id                UUID (FK → auth.users)
name                   TEXT
hostname               TEXT
ip_address             TEXT
port                   INTEGER (default: 22)
brand_id               UUID (FK → brands)
category_id            UUID (FK → categories)
credential_id          UUID (FK → credentials)
encrypted_credentials  TEXT (deprecated, usar credential_id)
backup_enabled         BOOLEAN
status                 TEXT ('active', 'inactive', 'error')
notes                  TEXT
last_backup_at         TIMESTAMPTZ
created_at             TIMESTAMPTZ
updated_at             TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* configurations */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">configurations</CardTitle>
                          <CardDescription>Configurações coletadas dos dispositivos (backups)</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id                UUID (PK)
device_id         UUID (FK → devices)
version           INTEGER (auto-incrementado por device)
config_data       TEXT (conteúdo da configuração)
config_hash       TEXT (hash SHA-256)
changes_detected  BOOLEAN
diff_summary      JSONB (resumo das alterações)
collection_method TEXT ('manual', 'scheduled', 'api')
collected_at      TIMESTAMPTZ
created_at        TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* audit_logs */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-mono">audit_logs</CardTitle>
                          <CardDescription>Log de auditoria de todas as ações</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`id          UUID (PK)
user_id     UUID
action      TEXT ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', etc)
table_name  TEXT
record_id   UUID
old_data    JSONB
new_data    JSONB
ip_address  TEXT
user_agent  TEXT
created_at  TIMESTAMPTZ`}
                          </pre>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <GitBranch className="h-5 w-5 text-primary" />
                      Relacionamentos
                    </h3>
                    <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
{`┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  profiles   │────▶│  user_roles  │     │ backup_templates│
└─────────────┘     └──────────────┘     └─────────────────┘
       │                                          │
       │                                          ▼
       ▼                                 ┌─────────────────┐
┌─────────────┐                          │ template_steps  │
│ credentials │                          └─────────────────┘
└─────────────┘                                   
       │                                          
       ▼                                 ┌─────────────────┐
┌─────────────┐     ┌──────────────┐     │   categories    │
│   devices   │────▶│configurations│     └─────────────────┘
└─────────────┘     └──────────────┘            │
       │                                        ▼
       ▼                                 ┌─────────────────┐
┌─────────────┐                          │backup_templates │
│   brands    │                          └─────────────────┘
└─────────────┘`}
                    </pre>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Cpu className="h-5 w-5 text-primary" />
                      Funções do Banco
                    </h3>
                    <div className="space-y-3">
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">has_role(user_id, role)</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Verifica se um usuário possui determinada role. Usa SECURITY DEFINER para evitar recursão RLS.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">is_admin(user_id)</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Atalho para verificar se usuário é admin. Retorna has_role(user_id, 'admin').
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">get_latest_version(device_uuid)</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Retorna a maior versão de configuração de um dispositivo para auto-incremento.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">handle_new_user()</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Trigger que cria profile e atribui role 'user' automaticamente ao criar usuário.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">update_updated_at_column()</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Trigger para atualizar automaticamente o campo updated_at.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ARQUITETURA */}
            <TabsContent value="architecture" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <FolderTree className="h-5 w-5 text-primary" />
                      Estrutura de Diretórios
                    </h3>
                    <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
{`src/
├── components/
│   ├── admin/                    # Componentes da área administrativa
│   │   ├── AboutProject.tsx      # Esta documentação
│   │   ├── AuditLogs.tsx         # Visualização de logs de auditoria
│   │   ├── CredentialsManagement.tsx  # CRUD de credenciais
│   │   ├── DatabaseStats.tsx     # Estatísticas do banco
│   │   ├── SecuritySettings.tsx  # Configurações de segurança
│   │   ├── SystemSettings.tsx    # Configurações do sistema
│   │   └── UserManagement.tsx    # Gerenciamento de usuários/roles
│   ├── templates/                # Componentes de templates de backup
│   │   ├── TemplateAdvancedSettings.tsx  # Config avançada
│   │   └── TemplateStepEditor.tsx  # Editor de passos
│   ├── ui/                       # Componentes shadcn/ui
│   ├── AppSidebar.tsx            # Menu lateral
│   ├── ConfigDiffViewer.tsx      # Comparador de configs
│   ├── DashboardHeader.tsx       # Header do dashboard
│   ├── DeviceList.tsx            # Lista de dispositivos
│   └── LayoutWrapper.tsx         # Layout com sidebar
├── hooks/
│   ├── use-mobile.tsx            # Detecção de mobile
│   └── use-toast.ts              # Hook de notificações
├── integrations/
│   └── supabase/
│       ├── client.ts             # Cliente Supabase (auto-gerado)
│       └── types.ts              # Tipos TypeScript (auto-gerado)
├── lib/
│   └── utils.ts                  # Utilitários (cn, etc)
├── pages/
│   ├── Admin.tsx                 # Painel administrativo
│   ├── Audit.tsx                 # Página de auditoria
│   ├── Auth.tsx                  # Login/Registro
│   ├── Backups.tsx               # Lista de backups
│   ├── BackupTemplates.tsx       # Gerenciar templates
│   ├── Brands.tsx                # Gerenciar marcas
│   ├── Categories.tsx            # Gerenciar categorias
│   ├── Dashboard.tsx             # Dashboard principal
│   ├── DeviceBackupHistory.tsx   # Histórico por dispositivo
│   ├── DeviceDetail.tsx          # Detalhes do dispositivo
│   ├── Devices.tsx               # Lista de dispositivos
│   ├── Diff.tsx                  # Comparação de versões
│   ├── Index.tsx                 # Página inicial
│   ├── Schedules.tsx             # Agendamentos
│   ├── SearchConfigs.tsx         # Busca em configurações
│   └── Versions.tsx              # Versões de config
├── App.tsx                       # Roteamento principal
├── App.css                       # Estilos globais
├── index.css                     # Tokens de design (Tailwind)
└── main.tsx                      # Entry point

supabase/
├── functions/
│   ├── create-test-user/         # Edge function: criar usuário teste
│   └── generate-mock-data/       # Edge function: dados de teste
├── migrations/                   # Migrations SQL (auto-gerado)
└── config.toml                   # Configuração Supabase`}
                    </pre>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Layers className="h-5 w-5 text-primary" />
                      Padrões de Arquitetura
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">React Query</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Usado para fetch de dados com cache automático, invalidação e sincronização.
                          Queries: useQuery. Mutations: useMutation com invalidateQueries.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Supabase Client</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Cliente único importado de @/integrations/supabase/client. Nunca criar 
                          múltiplas instâncias. Auth gerenciado pelo Supabase.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Componentes Shadcn/UI</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          UI library baseada em Radix. Componentes em src/components/ui. Customizáveis
                          via Tailwind e CSS variables.
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Row Level Security</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          Todas as tabelas usam RLS. Políticas por user_id. Funções SECURITY DEFINER
                          para verificação de roles sem recursão.
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Server className="h-5 w-5 text-primary" />
                      Edge Functions
                    </h3>
                    <div className="space-y-3">
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">generate-mock-data</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Gera dados de teste (marcas, categorias, dispositivos, configs). 
                            Requer autenticação JWT + role admin. Usa AES-256-GCM para criptografar 
                            credenciais de teste.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <code className="text-sm font-mono text-primary">create-test-user</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            Cria usuário de teste para desenvolvimento. Útil para testar fluxos 
                            de autenticação.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* SEGURANÇA */}
            <TabsContent value="security" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Shield className="h-5 w-5 text-primary" />
                      Modelo de Segurança
                    </h3>
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Row Level Security (RLS)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <p className="mb-2">Todas as tabelas têm RLS habilitado com políticas:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li><strong>SELECT:</strong> auth.uid() = user_id (ver próprios dados)</li>
                            <li><strong>INSERT:</strong> auth.uid() = user_id (criar próprios dados)</li>
                            <li><strong>UPDATE:</strong> auth.uid() = user_id (editar próprios dados)</li>
                            <li><strong>DELETE:</strong> auth.uid() = user_id (excluir próprios dados)</li>
                            <li><strong>Admin override:</strong> is_admin(auth.uid()) para acesso total</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Criptografia de Credenciais
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Senhas criptografadas com AES-256-GCM</li>
                            <li>Chave derivada usando PBKDF2 com salt</li>
                            <li>IV (Initialization Vector) único por criptografia</li>
                            <li>Formato: v1:aes256gcm:&lt;base64_encrypted&gt;</li>
                            <li>Chaves SSH armazenadas criptografadas</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Sistema de Roles
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Roles armazenadas em tabela separada (user_roles)</li>
                            <li>Função has_role() com SECURITY DEFINER</li>
                            <li>Verificação server-side via RLS policies</li>
                            <li>Nunca armazenar roles no localStorage</li>
                            <li>Admin pode gerenciar roles de outros usuários</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Edge Functions Protegidas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Verificação de JWT em todas as funções sensíveis</li>
                            <li>Verificação de role admin para operações críticas</li>
                            <li>Logging de tentativas não autorizadas</li>
                            <li>Uso de service_role apenas no backend</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Clock className="h-5 w-5 text-primary" />
                      Auditoria
                    </h3>
                    <Card>
                      <CardContent className="pt-4 text-sm text-muted-foreground">
                        <p className="mb-2">O sistema registra logs de auditoria para:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Logins e logouts de usuários</li>
                          <li>Criação, edição e exclusão de registros</li>
                          <li>Tentativas de acesso não autorizado</li>
                          <li>Execução de backups</li>
                          <li>Alterações em configurações de segurança</li>
                        </ul>
                        <p className="mt-3">
                          Logs incluem: user_id, action, table_name, record_id, old_data, new_data, 
                          ip_address, user_agent, timestamp.
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* FUNCIONALIDADES */}
            <TabsContent value="features" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <HardDrive className="h-5 w-5 text-primary" />
                      Funcionalidades Principais
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Dashboard</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Visão geral de dispositivos</li>
                            <li>Status de backups recentes</li>
                            <li>Alertas de configurações alteradas</li>
                            <li>Estatísticas gerais</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Gerenciamento de Dispositivos</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>CRUD completo de dispositivos</li>
                            <li>Associação com marca/categoria</li>
                            <li>Seleção de credencial de acesso</li>
                            <li>Status e notas por dispositivo</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Templates de Backup</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Editor de comandos simples</li>
                            <li>Editor de passos avançado</li>
                            <li>Configurações de timeout, prompt, paginação</li>
                            <li>Tratamento de erros configurável</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Coleta de Configurações</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Backup manual sob demanda</li>
                            <li>Agendamento automático (futuro)</li>
                            <li>Versionamento automático</li>
                            <li>Hash para detecção de mudanças</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Comparação de Versões</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Diff lado a lado</li>
                            <li>Destaque de linhas alteradas</li>
                            <li>Navegação entre diferenças</li>
                            <li>Histórico completo por dispositivo</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Busca em Configurações</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Busca textual em todas as configs</li>
                            <li>Filtro por dispositivo</li>
                            <li>Filtro por data</li>
                            <li>Regex support (futuro)</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Administração</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Gerenciamento de usuários</li>
                            <li>Atribuição de roles</li>
                            <li>Estatísticas do banco</li>
                            <li>Logs de auditoria</li>
                            <li>Configurações de segurança</li>
                            <li>Configurações do sistema</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Credenciais</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <ul className="list-disc list-inside space-y-1">
                            <li>CRUD de credenciais</li>
                            <li>Criptografia AES-256-GCM</li>
                            <li>Suporte a SSH keys</li>
                            <li>Reutilização entre dispositivos</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* TECNOLOGIAS */}
            <TabsContent value="tech" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <FileCode className="h-5 w-5 text-primary" />
                      Stack Tecnológico
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Frontend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge>React 18</Badge>
                            <Badge>TypeScript</Badge>
                            <Badge>Vite</Badge>
                            <Badge>Tailwind CSS</Badge>
                            <Badge>shadcn/ui</Badge>
                            <Badge>React Router</Badge>
                            <Badge>React Query</Badge>
                            <Badge>Recharts</Badge>
                            <Badge>Lucide Icons</Badge>
                            <Badge>Sonner (toasts)</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Backend (Lovable Cloud)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge>PostgreSQL</Badge>
                            <Badge>Supabase Auth</Badge>
                            <Badge>Row Level Security</Badge>
                            <Badge>Edge Functions (Deno)</Badge>
                            <Badge>Realtime (futuro)</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Bibliotecas UI</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">@radix-ui/*</Badge>
                            <Badge variant="outline">class-variance-authority</Badge>
                            <Badge variant="outline">clsx</Badge>
                            <Badge variant="outline">tailwind-merge</Badge>
                            <Badge variant="outline">tailwindcss-animate</Badge>
                            <Badge variant="outline">cmdk</Badge>
                            <Badge variant="outline">vaul</Badge>
                            <Badge variant="outline">embla-carousel</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Formulários & Validação</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">react-hook-form</Badge>
                            <Badge variant="outline">@hookform/resolvers</Badge>
                            <Badge variant="outline">zod</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Utilitários</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">date-fns</Badge>
                            <Badge variant="outline">react-day-picker</Badge>
                            <Badge variant="outline">input-otp</Badge>
                            <Badge variant="outline">react-resizable-panels</Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Dev Tools</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">ESLint</Badge>
                            <Badge variant="secondary">TypeScript</Badge>
                            <Badge variant="secondary">PostCSS</Badge>
                            <Badge variant="secondary">Autoprefixer</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <GitBranch className="h-5 w-5 text-primary" />
                      Variáveis de Ambiente
                    </h3>
                    <Card>
                      <CardContent className="pt-4">
                        <pre className="text-xs bg-muted p-3 rounded-md">
{`# Auto-geradas pelo Lovable Cloud (não editar)
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=[project-id]

# Secrets (configurados via Lovable)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL`}
                        </pre>
                      </CardContent>
                    </Card>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Comandos de Desenvolvimento
                    </h3>
                    <Card>
                      <CardContent className="pt-4">
                        <pre className="text-xs bg-muted p-3 rounded-md">
{`# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Build para produção
npm run build

# Verificar tipos TypeScript
npm run typecheck

# Lint do código
npm run lint`}
                        </pre>
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* PROMPT BASE */}
            <TabsContent value="prompt" className="mt-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Prompt para Recriar o Sistema
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="flex items-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copiar Prompt
                          </>
                        )}
                      </Button>
                    </div>
                    <Card className="mb-4 border-amber-500/50 bg-amber-50/10">
                      <CardContent className="pt-4">
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          <strong>⚠️ Nota:</strong> Este prompt usa <strong>MySQL + Node.js/Express</strong> como backend. 
                          As outras abas desta documentação descrevem a implementação ATUAL que usa <strong>Lovable Cloud (PostgreSQL/Supabase)</strong>. 
                          Use este prompt para recriar o sistema em ambientes MySQL independentes.
                        </p>
                      </CardContent>
                    </Card>
                    <p className="text-sm text-muted-foreground mb-4">
                      Este prompt contém todas as especificações necessárias para recriar o sistema 
                      Configuard do zero usando uma IA como o Lovable, Claude ou GPT com backend MySQL.
                    </p>
                    <Card>
                      <CardContent className="pt-4">
                        <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {basePrompt}
                        </pre>
                      </CardContent>
                    </Card>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Como Usar Este Prompt
                    </h3>
                    <div className="space-y-3">
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-medium mb-2">1. Copie o Prompt</h4>
                          <p className="text-sm text-muted-foreground">
                            Clique no botão "Copiar Prompt" acima para copiar todo o conteúdo para a área de transferência.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-medium mb-2">2. Cole em uma IA</h4>
                          <p className="text-sm text-muted-foreground">
                            Cole o prompt no Lovable, Claude, GPT-4 ou outra IA de desenvolvimento. 
                            O prompt contém todas as especificações de banco, segurança e funcionalidades.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-medium mb-2">3. Itere Conforme Necessário</h4>
                          <p className="text-sm text-muted-foreground">
                            O prompt serve como base. Você pode adicionar ou remover funcionalidades 
                            conforme suas necessidades específicas.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                      <Shield className="h-5 w-5 text-primary" />
                      Avisos Importantes
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-yellow-500/50">
                        <CardContent className="pt-4">
                          <h4 className="font-medium text-yellow-600 dark:text-yellow-400 mb-2">Segurança</h4>
                          <p className="text-sm text-muted-foreground">
                            Certifique-se de implementar todas as políticas RLS e criptografia 
                            de credenciais conforme especificado. Não pule estas etapas.
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-500/50">
                        <CardContent className="pt-4">
                          <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-2">Customização</h4>
                          <p className="text-sm text-muted-foreground">
                            O prompt é uma base. Adapte os tipos de dispositivo, comandos de backup 
                            e estrutura conforme seu ambiente de rede.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
