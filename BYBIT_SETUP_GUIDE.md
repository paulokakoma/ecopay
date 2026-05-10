# 🔐 Guia Completo: Configuração de Transferências Automáticas Bybit

## 📋 Visão Geral

Este guia descreve como configurar sua conta Bybit para permitir que o EcoPay execute transferências automáticas de criptomoedas diretamente do seu site.

---

## 1️⃣ Pré-Requisitos

- ✅ Conta Bybit ativa (nível 2 ou superior de verificação)
- ✅ Acesso ao painel de administração da Bybit
- ✅ IP estático do servidor (ou IP do serviço como Fly.io, Railway, etc)
- ✅ Saldo de USDT na carteira Spot (Funding Wallet)

---

## 2️⃣ Passo 1: Criar Chave API na Bybit

### A. Acesse o Painel de Gerenciamento de API

1. Faça login em https://www.bybit.com
2. Clique em **Account** (canto superior direito)
3. Vá para **Account & Security** → **API Management** (ou **Users** → **API**)

### B. Crie uma Nova Chave API

```
Clique em "Create API Key" ou "+ New key"
```

### C. Selecione as Opções Corretas

**Tipo de Chave:**
```
□ System Generated (recomendado - mais seguro)
◉ Self-Generated (alternativa)
```

**Permissões (CRÍTICO):**
```
✅ Read (para verificar saldo)
✅ Read-Write (necessário para saques)
❌ Trade (deixe desativado)
❌ Transfer (deixe desativado - não é necessário para saques)
```

**Endereços IP Autorizados (CRÍTICO):**
```
Você DEVE adicionar o IP do seu servidor
Exemplos:
- Se usa Fly.io:    adicione o IP saído nos logs do Fly
- Se usa Railway:   adicione o IP estático
- Se usa seu PC:    adicione seu IP público (ifconfig.me)
```

**Período de Validade:**
```
Recomendado: Sem expiração (selecione "Unrestricted")
```

### D. Salve as Credenciais

```
⚠️ IMPORTANTE: O API Secret é mostrado APENAS UMA VEZ
- Copie a API Key
- Copie o API Secret
- Guarde em lugar seguro (senha manager, etc)
- NUNCA compartilhe ou commite no GitHub
```

---

## 3️⃣ Passo 2: Configurar Whitelist de IPs

### A. Encontre o IP do Seu Servidor

**Se usa Fly.io:**
```bash
fly status -a seu_app_name
# Procure por "allocated address"
# Ou veja em Monitoring → Recent Logs
```

**Se usa Railway:**
```bash
# O IP muda dinamicamente
# Configure um serviço de IP dinâmico ou use proxy
```

**Se usa seu computador (teste local):**
```bash
# macOS/Linux:
curl ifconfig.me

# Ou acesse:
https://ifconfig.me/
https://whatismyipaddress.com/
```

### B. Adicione o IP à Whitelist

1. No painel de API da Bybit
2. Clique em **Restrict access to certain IPs** (ou similar)
3. Clique em **"+ Add IP"**
4. Digite seu IP (ex: `203.0.113.45`)
5. Clique em **Save**

⚠️ **SEM ISSO, A API NÃO FUNCIONARÁ PARA SAQUES**

---

## 4️⃣ Passo 3: Whitelist de Endereços de Saque (OPCIONAL MAS RECOMENDADO)

### Se você vai fazer saques para endereços específicos:

1. Vá para **Asset** → **Withdrawal Address Management** (ou **Wallet** → **Address Management**)
2. Clique em **"+ Add Address"**
3. Selecione:
   - Moeda: `USDT`
   - Rede: `BSC (BEP20)` ou `TRC20 (Tron)` conforme necessário
4. Cole o endereço de destino
5. Aguarde aprovação (geralmente 24-48 horas)

⚠️ **SEM WHITELIST, SAQUES PODEM SER BLOQUEADOS**

---

## 5️⃣ Passo 4: Configurar Variáveis de Ambiente

### A. Edite o arquivo `.env`

```bash
# Copie o template
cp .env.example .env

# Edite com suas credenciais
nano .env
```

### B. Preencha com suas Credenciais Bybit

```env
# ====================================
# BYBIT API (suas credenciais)
# ====================================

BYBIT_API_KEY=Vlkzxxxxxxxxxxxxxxxxxxxxxx
BYBIT_API_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

# Teste na testnet primeiro (true = testnet, false = mainnet)
BYBIT_TESTNET=false

# Simulação local (true = não chama API real)
MOCK_BYBIT=false
```

### C. Nunca Commite o `.env`

```bash
# Verifique se está em .gitignore
grep -n ".env" .gitignore

# Se não estiver, adicione:
echo ".env" >> .gitignore
```

---

## 6️⃣ Passo 5: Testar a Conexão

### A. Teste via Terminal

```bash
# No diretório do projeto
cd /Users/av/Desktop/ecopay/backend

# Teste a conexão com Bybit
node -e "
const bybit = require('./services/bybit');
bybit.testConnection().then(result => {
  console.log('Conexão:', result ? 'OK ✅' : 'FALHOU ❌');
});
"
```

### B. Teste via API

```bash
# Inicie o servidor
npm start

# Em outro terminal, teste
curl http://localhost:3001/api/payments/bybit-test

# Resposta esperada:
# { "success": true, "status": "connected" }
```

### C. Teste via Interface Web

1. Acesse http://localhost:3001
2. Vá para aba **Transferência**
3. Veja se o saldo aparece

---

## 7️⃣ Passo 6: Configurar Automação (Cronjob para Polling)

Se você quer que as transferências sejam rastreadas automaticamente:

### A. Criar um Serviço de Polling

```javascript
// backend/services/withdrawalPoller.js

const bybit = require('./bybit');
const supabase = require('./supabase');

async function pollWithdrawals() {
  try {
    // Obtém últimos saques
    const withdrawals = await bybit.getWithdrawalHistory(50);
    
    for (const withdrawal of withdrawals.data) {
      // Atualiza status no banco de dados
      await supabase
        .from('ecopay_transactions')
        .update({ 
          payment_status: withdrawal.status === 'success' ? 'liquidated' : 'pending',
          bybit_withdraw_id: withdrawal.withdrawId
        })
        .eq('bybit_withdraw_id', withdrawal.withdrawId);
    }
    
    console.log(`[Poller] ${withdrawals.data.length} saques verificados`);
  } catch (error) {
    console.error('[Poller] Erro:', error.message);
  }
}

// Executa a cada 5 minutos
setInterval(pollWithdrawals, 5 * 60 * 1000);

module.exports = { pollWithdrawals };
```

### B. Integrar no App Principal

```javascript
// backend/app.js

require('./services/withdrawalPoller');  // Adicione esta linha

app.listen(PORT, () => {
  console.log(`EcoPay Server running on port ${PORT}`);
});
```

---

## 8️⃣ Fluxo Completo de Transferência

```
┌─────────────────────────────────────┐
│   1. Usuário clica "Sacar"          │
│      (no dashboard do site)         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   2. Frontend envia para Backend     │
│      POST /api/payments/instant-    │
│      withdraw                       │
│      { address, amount, chain }     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   3. Backend valida:                │
│      - Usuário autenticado?         │
│      - Saldo suficiente?            │
│      - Limite diário OK?            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   4. Backend chama Bybit API        │
│      (SDK oficial RestClientV5)     │
│      submitWithdrawal({...})        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   5. Bybit processa:                │
│      - Verifica IP whitelist        │
│      - Verifica assinatura HMAC     │
│      - Verifica saldo               │
│      - Envia criptografia           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   6. Resposta retorna para Backend  │
│      { withdrawId, status }         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   7. Backend salva em BD:           │
│      - withdrawId                   │
│      - timestamp                    │
│      - status: "pending"            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   8. Cronjob verifica a cada 5min   │
│      - Consulta status via API      │
│      - Atualiza BD quando mudar     │
│      - Notifica usuário             │
└─────────────────────────────────────┘
```

---

## 9️⃣ Troubleshooting

### ❌ Erro: "IP not in whitelist"

**Solução:**
```
1. Verifique seu IP público: curl ifconfig.me
2. Adicione o IP na Bybit (Account → API)
3. Aguarde ~5 minutos para sincronizar
4. Tente novamente
```

### ❌ Erro: "Invalid API Key"

**Solução:**
```
1. Copie a chave EXATAMENTE (sem espaços)
2. Regenere se perdeu (delete a chave e crie nova)
3. Verifique se não expirou
```

### ❌ Erro: "Signature verification failed"

**Solução:**
```
1. Verifique se API Secret está correto
2. Regenere a chave (Secret só aparece uma vez!)
3. Sincronize hora do servidor: ntpdate -s time.apple.com
```

### ❌ Erro: "Insufficient balance"

**Solução:**
```
1. Faça login na Bybit e verifique saldo de USDT
2. Considere taxas de rede (1-2 USDT)
3. Aguarde confirmação de depósitos
4. Use BYBIT_TESTNET=true para testar sem usar fundos reais
```

### ❌ Erro: "Address not whitelisted"

**Solução:**
```
1. Adicione o endereço em Asset → Withdrawal Address Management
2. Aguarde 24-48 horas de aprovação
3. Ou use forceChain=0 para deixar Bybit detectar automaticamente
```

---

## 🔟 Segurança: Boas Práticas

### ✅ FAZER:

```javascript
// ✅ Use SDK oficial
const { RestClientV5 } = require('bybit-api');

// ✅ Valide SEMPRE no backend
if (!validateAddress(address)) throw new Error('Invalid');

// ✅ Use variáveis de ambiente
const apiKey = process.env.BYBIT_API_KEY;

// ✅ Log de transações para auditoria
console.log(`[AUDIT] Saque: ${amount} para ${address}`);

// ✅ Confirme com usuário antes de sacar
if (!confirm('Tem certeza?')) return;
```

### ❌ NUNCA FAZER:

```javascript
// ❌ Chame API diretamente do frontend
const result = await fetch('api.bybit.com', { ... });

// ❌ Hardcode credenciais
const apiKey = 'Vlkzxxxxxxxxxxxxxx';

// ❌ Ignore limites da Bybit
const amount = 999999999; // Sem validação

// ❌ Confie em dados do usuário
const address = req.body.address; // Sem validar

// ❌ Comite .env no GitHub
git add .env  // NUNCA!
```

---

## 1️⃣1️⃣ Configuração em Produção

### Quando deployer em Fly.io/Railway:

```bash
# 1. Adicione variáveis de ambiente
fly secrets set BYBIT_API_KEY=seu_key
fly secrets set BYBIT_API_SECRET=seu_secret
fly secrets set BYBIT_TESTNET=false

# 2. Verifique IP do servidor
fly status -a seu_app

# 3. Atualize whitelist de IP na Bybit com o novo IP
```

### Quando usar domínio próprio:

```
1. Configure CORS apenas para seu domínio
2. Use HTTPS obrigatoriamente
3. Adicione Rate Limiting na API
4. Implemente 2FA para saques grandes
```

---

## 1️⃣2️⃣ Próximos Passos

- [ ] ✅ Criar chave API na Bybit
- [ ] ✅ Whitelist de IPs
- [ ] ✅ Whitelist de endereços (opcional)
- [ ] ✅ Preencher `.env`
- [ ] ✅ Testar conexão
- [ ] ✅ Fazer primeiro saque de teste
- [ ] ✅ Configurar cronjob de polling
- [ ] ✅ Integrar webhooks (advanced)
- [ ] ✅ Deploy em produção

---

**Precisa de ajuda?**

- Documentação Bybit: https://bybit-exchange.github.io/docs/
- Status da API: https://status.bybit.com/
- Suporte: https://www.bybit.com/en-US/help-center/
