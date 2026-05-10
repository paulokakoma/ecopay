# Documentação: Transferências Bybit API

## Visão Geral

O EcoPay agora suporta dois tipos de transferências via API Bybit:
1. **Transferência Entre Contas Bybit** - Transferência direta entre contas Bybit usando email
2. **Transferência Universal** - Transferências para sub-contas ou carteiras externas

---

## 1. Transferência Entre Contas Bybit

### Descrição
Transfere USDT de uma conta Bybit para outra usando o email de destino.

### Endpoint
```
POST /api/payments/transfer-bybit-account
```

### Parâmetros
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `recipientEmail` | string | Sim | Email da conta Bybit de destino |
| `amount` | number | Sim | Quantidade a transferir (ex: 100.50) |
| `coin` | string | Não | Moeda (padrão: USDT) |

### Exemplo de Requisição
```javascript
const response = await fetch('http://localhost:3001/api/payments/transfer-bybit-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipientEmail: 'destinatario@example.com',
    amount: 100,
    coin: 'USDT'
  })
});

const data = await response.json();
console.log(data);
```

### Resposta de Sucesso (200)
```json
{
  "success": true,
  "message": "Transferência iniciada com sucesso!",
  "data": {
    "transferId": "TRANSFER-1234567890-abc123",
    "status": "success"
  }
}
```

### Resposta de Erro (400/500)
```json
{
  "success": false,
  "error": "Erro Bybit (400001): Invalid recipient email"
}
```

### Possíveis Erros
- `400001` - Email do destinatário inválido
- `110043` - Fundos insuficientes
- `110044` - Conta bloqueada
- Timeout ou erros de conexão

---

## 2. Transferência Universal

### Descrição
Transferências mais flexíveis que podem ser direcionadas para sub-contas ou carteiras externas.

### Endpoint
```
POST /api/payments/universal-transfer
```

### Parâmetros
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `recipient` | string | Sim | Email ou endereço de carteira |
| `amount` | number | Sim | Quantidade a transferir |
| `coin` | string | Não | Moeda (padrão: USDT) |
| `type` | string | Não | TRANSFER (sub-account) ou WITHDRAW (externo) - padrão: TRANSFER |

### Exemplo de Requisição
```javascript
// Transferência para sub-conta
const response = await fetch('http://localhost:3001/api/payments/universal-transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipient: 'subaccount@example.com',
    amount: 50.25,
    coin: 'USDT',
    type: 'TRANSFER'
  })
});

const data = await response.json();
console.log(data);
```

### Resposta de Sucesso (200)
```json
{
  "success": true,
  "message": "Transferência universal iniciada com sucesso!",
  "data": {
    "transferId": "UNIV-TRANSFER-1234567890-xyz789",
    "status": "success"
  }
}
```

### Tipos de Transferência
- **TRANSFER**: Para sub-contas Bybit (recomendado para contas vinculadas)
- **WITHDRAW**: Para carteiras externas (ex: outra exchange, carteira pessoal)

---

## 3. Usando o Painel de Testes

Acesse o painel em `http://localhost:3001` e clique na aba "Transferência".

### Transferência Entre Contas
1. Clique em "Entre Contas"
2. Informe o email da conta destinatária
3. Informe a quantidade
4. Clique em "Transferir"

### Transferência Universal
1. Clique em "Transferência Universal"
2. Informe o destinatário (email ou endereço)
3. Informe a quantidade
4. Selecione o tipo (TRANSFER ou WITHDRAW)
5. Clique em "Transferir"

---

## 4. Implementação no Serviço Bybit

### Métodos Disponíveis

#### `transferBetweenAccounts(toEmail, amount, coin)`
```javascript
const result = await bybit.transferBetweenAccounts(
  'destinatario@example.com',
  100,
  'USDT'
);
```

#### `universalTransfer(recipient, amount, coin, type)`
```javascript
const result = await bybit.universalTransfer(
  'subaccount@example.com',
  50.25,
  'USDT',
  'TRANSFER'
);
```

---

## 5. Autenticação e Segurança

Todas as requisições são autenticadas usando:
- **API Key**: De `BYBIT_API_KEY`
- **API Secret**: De `BYBIT_API_SECRET`
- **Assinatura HMAC-SHA256**: Calculada para cada requisição
- **Sincronização de Tempo**: Sincroniza automaticamente com servidores Bybit

### Variáveis de Ambiente Necessárias
```env
BYBIT_API_KEY=sua_api_key_aqui
BYBIT_API_SECRET=seu_api_secret_aqui
BYBIT_BASE_URL=https://api.bybit.com
```

---

## 6. Fluxo de Transferência Completo

```
┌─────────────────┐
│   Frontend      │
│  (index.html)   │
└────────┬────────┘
         │ POST /api/payments/transfer-bybit-account
         ▼
┌─────────────────────────┐
│  Express Router         │
│  (routes/payment.js)    │
└────────┬────────────────┘
         │ Valida entrada
         │ Chama bybit.transferBetweenAccounts()
         ▼
┌─────────────────────────┐
│  Serviço Bybit          │
│  (services/bybit.js)    │
└────────┬────────────────┘
         │ Sincroniza tempo
         │ Gera assinatura
         │ POST /v5/asset/transfer/inter-transfer
         ▼
┌─────────────────────────┐
│  API Bybit              │
│  (api.bybit.com)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Resposta JSON          │
│  { retCode, retMsg }    │
└─────────────────────────┘
```

---

## 7. Dicas e Boas Práticas

### ✅ Fazer
- Validar sempre os inputs do usuário
- Confirmar com o usuário antes de executar transferências
- Armazenar IDs de transferência para rastreamento
- Monitorar logs de erro
- Usar `MOCK_BYBIT=true` para testes sem API real

### ❌ Não Fazer
- Expor API Keys no frontend
- Aceitar transferências sem confirmação do usuário
- Ignorar erros da API Bybit
- Fazer requisições simultâneas em excesso
- Armazenar secrets em repositórios públicos

---

## 8. Troubleshooting

### Erro: "Invalid recipient email"
- Verifique se o email existe numa conta Bybit
- Confirme que a conta não está bloqueada
- Tente novamente em alguns minutos

### Erro: "Insufficient balance"
- Verifique o saldo USDT da conta
- Considere o tempo de sincronização de fundos
- Tente um valor menor

### Erro: "Timestamp error"
- O servidor sincroniza automaticamente com Bybit
- Se persistir, reinicie a aplicação
- Verifique a hora do servidor

### Erro: "Signature verification failed"
- Verifique se BYBIT_API_KEY está correto
- Verifique se BYBIT_API_SECRET está correto
- Confirme que as credenciais são da mesma conta

---

## 9. Exemplos Completos

### Usando cURL
```bash
curl -X POST http://localhost:3001/api/payments/transfer-bybit-account \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "user@example.com",
    "amount": 100,
    "coin": "USDT"
  }'
```

### Usando Python
```python
import requests
import json

url = 'http://localhost:3001/api/payments/transfer-bybit-account'
payload = {
    'recipientEmail': 'user@example.com',
    'amount': 100,
    'coin': 'USDT'
}

response = requests.post(url, json=payload)
print(response.json())
```

### Usando Node.js
```javascript
const axios = require('axios');

async function transferUSDT() {
  try {
    const response = await axios.post(
      'http://localhost:3001/api/payments/transfer-bybit-account',
      {
        recipientEmail: 'user@example.com',
        amount: 100,
        coin: 'USDT'
      }
    );
    console.log('Sucesso:', response.data);
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

transferUSDT();
```

---

## 10. Próximas Implementações

- [ ] Webhook para confirmação de transferência
- [ ] Histórico de transferências detalhado
- [ ] Limites de transferência por conta
- [ ] Suporte para outras moedas (USDC, BTC, ETH)
- [ ] Confirmação por 2FA
- [ ] Rate limiting

