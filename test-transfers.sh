#!/bin/bash

# Script de teste para Transferências Bybit
# Uso: ./test-transfers.sh

API_URL="http://localhost:3001"

echo "🔄 Teste de Transferências Bybit API"
echo "======================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Teste 1: Transferência Entre Contas
echo -e "${YELLOW}[1] Testando Transferência Entre Contas Bybit${NC}"
echo "Transferindo 10 USDT para uma conta Bybit..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/api/payments/transfer-bybit-account" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "test@example.com",
    "amount": 10,
    "coin": "USDT"
  }')

echo "Resposta:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Teste 2: Transferência Universal (TRANSFER)
echo -e "${YELLOW}[2] Testando Transferência Universal (Sub-conta)${NC}"
echo "Transferindo 5 USDT para sub-conta..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/api/payments/universal-transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "subaccount@example.com",
    "amount": 5,
    "coin": "USDT",
    "type": "TRANSFER"
  }')

echo "Resposta:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Teste 3: Transferência Universal (WITHDRAW)
echo -e "${YELLOW}[3] Testando Transferência Universal (Saque Externo)${NC}"
echo "Transferindo 2.5 USDT para carteira externa..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/api/payments/universal-transfer" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "external@example.com",
    "amount": 2.5,
    "coin": "USDT",
    "type": "WITHDRAW"
  }')

echo "Resposta:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Teste 4: Validar Carteira
echo -e "${YELLOW}[4] Testando Validação de Carteira${NC}"
echo "Validando endereço BSC..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/api/payments/validate-wallet" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x8894E0a0c962CB723c1976aEd1D0F3Fe0b4C7f00",
    "coin": "USDT",
    "chain": "BSC"
  }')

echo "Resposta:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo "Dicas:"
echo "- Use jq para formatar a saída JSON: jq '.'"
echo "- Substitua emails por contas reais para testes efetivos"
echo "- Verifique os logs do backend com: npm run dev"
echo ""
