# 🔧 Guia de Troubleshooting - Transferências Bybit

## Problemas Comuns e Soluções

### 1. ❌ Erro: "Invalid API Key"

**Causa**: API Key incorreta ou expirada

**Soluções**:
```bash
# 1. Verifique se a chave está no .env
grep BYBIT_API_KEY .env

# 2. Regenere a chave em https://www.bybit.com
# Account → My Wallet → API (ou Users → My API)
# Clique em "Manage" → "Edit" ou delete e criar nova

# 3. Teste com MOCK_BYBIT=true primeiro
MOCK_BYBIT=true npm start

# 4. Verifique se não tem espaços extras
# Errado: BYBIT_API_KEY=abc123 def
# Certo:  BYBIT_API_KEY=abc123def
```

---

### 2. ❌ Erro: "Signature verification failed"

**Causa**: API Secret errado ou alterações no payload

**Soluções**:
```bash
# 1. Verifique se o secret está correto
grep BYBIT_API_SECRET .env

# 2. Regenere a chave (o secret é mostrado apenas uma vez)
# Acesse Account → API e delete/recrie a chave

# 3. Verifique se JSON está bem formatado
curl -X POST http://localhost:3001/api/payments/transfer-bybit-account \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"test@example.com","amount":10}'

# 4. Verifique o console do servidor
npm run dev  # Procure por erros de assinatura
```

---

### 3. ❌ Erro: "Timestamp error" ou "Invalid timestamp"

**Causa**: Relógio do servidor dessincronizado

**Soluções**:
```bash
# 1. Sincronize a hora do servidor
# macOS/Linux:
sudo ntpdate -s time.apple.com
# ou
date

# 2. Reinicie o serviço Node.js
npm run dev

# 3. Verifique o offset de tempo
# O serviço bybit.js loga: "[Bybit] Time Synced. Offset: XXXms"

# 4. Se usar Docker
docker exec <container> date  # Verificar hora

# 5. Se o offset for grande (> 5000ms), reinicie
systemctl restart ntp  # ou
sudo systemctl restart systemd-timesyncd
```

---

### 4. ❌ Erro: "Invalid recipient email"

**Causa**: Email não existe em conta Bybit ou formato inválido

**Soluções**:
```javascript
// ❌ Errado
{
  "recipientEmail": "user",  // Falta domínio
  "amount": 100
}

// ✅ Correto
{
  "recipientEmail": "user@example.com",  // Email completo
  "amount": 100
}

// ✅ Verificar se email existe
// 1. Faça login em Bybit
// 2. Vá para Account → My Wallet → Members
// 3. Procure o email da sub-conta
// 4. Verifique se a sub-conta está ativa
```

---

### 5. ❌ Erro: "Insufficient balance"

**Causa**: Saldo insuficiente de USDT

**Soluções**:
```bash
# 1. Verifique o saldo em https://www.bybit.com
# Account → My Wallet → Spot (procure USDT)

# 2. Considere taxas de rede
# Se tentar transferir 100 USDT, pode precisar de 101 (com taxa)

# 3. Aguarde confirmação de depósitos
# Depósitos podem levar alguns minutos para aparecer

# 4. Para testes, use MOCK_BYBIT=true
MOCK_BYBIT=true npm start

# 5. Solicite teste fiat aos administradores
# Se estiver em produção, use conta de teste
```

---

### 6. ❌ Erro: "Account blocked" ou "Account restricted"

**Causa**: Conta foi bloqueada ou tem restrições

**Soluções**:
```bash
# 1. Faça login em https://www.bybit.com
# 2. Verifique notificações ou avisos na conta

# 3. Possíveis razões:
# - Ativação de 2FA não confirmada
# - Suspeita de atividade fraudulenta
# - Violação de termos de serviço
# - Limite de API excedido

# 4. Contate suporte Bybit se necessário
# https://www.bybit.com/en-US/help-center/

# 5. Para testes, use uma conta diferente
```

---

### 7. ❌ Erro: "Connection refused" ou "ECONNREFUSED"

**Causa**: API Bybit inacessível ou servidor Node.js não está rodando

**Soluções**:
```bash
# 1. Verifique se o servidor está rodando
ps aux | grep node
# ou
lsof -i :3001

# 2. Inicie o servidor
npm start
# ou para desenvolvimento
npm run dev

# 3. Verifique conectividade com Bybit
ping api.bybit.com
# ou
curl -I https://api.bybit.com

# 4. Se usar firewall/VPN
# Certifique-se de que api.bybit.com não está bloqueado

# 5. Verifique BYBIT_BASE_URL no .env
grep BYBIT_BASE_URL .env
# Deve ser: https://api.bybit.com (com HTTPS!)
```

---

### 8. ❌ Erro: "Endpoint not found" (404)

**Causa**: Rota não existe ou foi digitada errada

**Soluções**:
```bash
# Endpoints corretos:
# POST /api/payments/transfer-bybit-account
# POST /api/payments/universal-transfer
# POST /api/payments/validate-wallet

# ❌ Errado: /api/payments/transfer
# ✅ Correto: /api/payments/transfer-bybit-account

# Verifique em backend/routes/payment.js
cat backend/routes/payment.js | grep "router.post"

# Teste com curl
curl -X POST http://localhost:3001/api/payments/transfer-bybit-account \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"test@example.com","amount":10}'
```

---

### 9. ❌ Erro: "Missing required fields"

**Causa**: Faltam parâmetros obrigatórios

**Soluções**:
```javascript
// ❌ Errado - falta amount
{
  "recipientEmail": "user@example.com"
}

// ✅ Correto - todos os campos
{
  "recipientEmail": "user@example.com",
  "amount": 100,
  "coin": "USDT"  // opcional, padrão USDT
}

// Para universal-transfer
// ❌ Errado - falta recipient
{
  "amount": 100
}

// ✅ Correto
{
  "recipient": "user@example.com",
  "amount": 100,
  "coin": "USDT",
  "type": "TRANSFER"  // opcional, padrão TRANSFER
}
```

---

### 10. ❌ Erro: "CORS error" ou "Access-Control-Allow-Origin"

**Causa**: Frontend e backend em domínios diferentes

**Soluções**:
```javascript
// Frontend recebe erro:
// Access to XMLHttpRequest at 'http://api.example.com' 
// from origin 'http://localhost:3000' has been blocked by CORS policy

// 1. Verifique app.js tem CORS ativado
grep -A 2 "cors()" backend/app.js

// 2. Se não tiver:
const cors = require('cors');
app.use(cors());

// 3. Para produção, restrinja origens
app.use(cors({
  origin: ['https://ecopay.com', 'https://app.ecopay.com']
}));

// 4. Teste com curl (sem CORS)
curl -X POST http://localhost:3001/api/payments/transfer-bybit-account \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail":"test@example.com","amount":10}'
```

---

### 11. ❌ Erro: "500 Internal Server Error"

**Causa**: Erro não capturado no servidor

**Soluções**:
```bash
# 1. Verifique os logs do servidor
npm run dev  # Mostra logs em tempo real

# 2. Se usar Docker
docker logs <container_name> -f

# 3. Se usar Fly.io
fly logs

# 4. Ative modo debug
DEBUG=* npm start

# 5. Testes progressivos
# - Primeiro: teste com MOCK_BYBIT=true
# - Depois: teste endpoint /api/payments/validate-wallet
# - Depois: teste com email fake (vai dar erro, mas identifica problema)
# - Por fim: teste com transferência real

# 6. Verifique logs detalhados em production
cat backend/logs/error.log
```

---

### 12. ❌ Transferência não aparece em histórico

**Causa**: Webhook não está registrado ou Supabase não está configurado

**Soluções**:
```bash
# 1. Verifique se Supabase está configurado
grep SUPABASE .env

# 2. Teste conexão com Supabase
node -e "const sb = require('./backend/services/supabase'); console.log(sb)"

# 3. Verifique se tabelas existem
# Supabase → SQL Editor → Execute:
SELECT * FROM ecopay_transactions LIMIT 1;

# 4. Se transferências forem via endpoint direto (sem webhook)
# Elas não ficarão em histórico. Integre webhook:

// No webhook endpoint da Bybit, registre:
router.post('/webhook/bybit', async (req, res) => {
  const { transferId, status } = req.body;
  // Registre em banco de dados
});

# 5. Para teste, verifique logs do servidor
npm run dev | grep -i transaction
```

---

## Debugging Avançado

### Ativar Logs Detalhados

```javascript
// backend/app.js
const morgan = require('morgan');
app.use(morgan('dev'));  // Logs de requisições HTTP

// backend/services/bybit.js
console.log('[Bybit] Request:', { timestamp, apiKey, signature });
console.log('[Bybit] Response:', response.data);
```

### Testar com Postman/Insomnia

```
1. Crie nova requisição POST
2. URL: http://localhost:3001/api/payments/transfer-bybit-account
3. Headers:
   - Content-Type: application/json
4. Body (raw):
{
  "recipientEmail": "test@example.com",
  "amount": 100,
  "coin": "USDT"
}
5. Clique Send
6. Verifique Response
```

### Inspecionar Network (Frontend)

```javascript
// Abra DevTools (F12) e vá para Network
// Encontre a requisição POST
// Verifique:
// - Request body
// - Response headers
// - Response body
// - Status code
```

---

## Checklist de Diagnóstico

```
□ .env file existe e foi preenchido?
□ node_modules instalado? (npm install)
□ Servidor está rodando? (npm start ou npm run dev)
□ API Key e API Secret estão corretos?
□ Conta Bybit está ativa e não bloqueada?
□ Saldo de USDT é suficiente?
□ Email do destinatário existe e é válido?
□ Conexão com internet está OK?
□ Firewall permite acesso a api.bybit.com?
□ Relógio do servidor está sincronizado?
□ Headers Content-Type estão corretos?
□ JSON payload está bem formatado?
□ Todos os campos obrigatórios foram preenchidos?
□ Frontend consegue acessar o backend?
□ Supabase está configurado (se usando banco de dados)?
□ Logs do servidor mostram alguma pista?
```

---

## Recursos Úteis

- **Documentação Bybit**: https://bybit-exchange.github.io/docs/
- **Status da API Bybit**: https://status.bybit.com/
- **Suporte Bybit**: https://www.bybit.com/en-US/help-center/
- **Node.js Debugging**: https://nodejs.org/en/docs/guides/simple-profiling/
- **HTTP Status Codes**: https://httpwg.org/specs/rfc7231.html#status.codes

---

**Precisa de ajuda?**

Se o erro persistir:
1. Ative MOCK_BYBIT=true para eliminar Bybit como variável
2. Teste com curl para eliminar frontend como variável
3. Verifique os logs do servidor com npm run dev
4. Compare com exemplos em BYBIT_TRANSFERS.md

