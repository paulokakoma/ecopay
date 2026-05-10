/**
 * Exemplo de Integração: Cliente EcoPay para Transferências Bybit
 * 
 * Use este arquivo como referência para integrar transferências Bybit
 * em suas aplicações Node.js/JavaScript
 */

const axios = require('axios');

class EcoPayClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Transferência entre contas Bybit
   * @param {string} recipientEmail - Email da conta de destino
   * @param {number} amount - Quantidade a transferir (ex: 100.50)
   * @param {string} coin - Moeda (padrão: USDT)
   * @returns {Promise<Object>} Resposta da API
   */
  async transferBetweenAccounts(recipientEmail, amount, coin = 'USDT') {
    try {
      const response = await this.client.post('/api/payments/transfer-bybit-account', {
        recipientEmail,
        amount: parseFloat(amount),
        coin
      });

      if (response.data.success) {
        return {
          success: true,
          transferId: response.data.data?.transferId,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        throw new Error(response.data.error || 'Erro desconhecido');
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Transferência Universal (para sub-contas ou carteiras externas)
   * @param {string} recipient - Email ou endereço de destino
   * @param {number} amount - Quantidade a transferir
   * @param {string} coin - Moeda (padrão: USDT)
   * @param {string} type - TRANSFER (sub-conta) ou WITHDRAW (externo)
   * @returns {Promise<Object>} Resposta da API
   */
  async universalTransfer(recipient, amount, coin = 'USDT', type = 'TRANSFER') {
    try {
      if (!['TRANSFER', 'WITHDRAW'].includes(type)) {
        throw new Error('Tipo inválido. Use TRANSFER ou WITHDRAW');
      }

      const response = await this.client.post('/api/payments/universal-transfer', {
        recipient,
        amount: parseFloat(amount),
        coin,
        type
      });

      if (response.data.success) {
        return {
          success: true,
          transferId: response.data.data?.transferId,
          message: response.data.message,
          data: response.data.data
        };
      } else {
        throw new Error(response.data.error || 'Erro desconhecido');
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Validar endereço de carteira
   * @param {string} address - Endereço da carteira
   * @param {string} coin - Moeda (padrão: USDT)
   * @param {string} chain - Rede (BSC ou TRC20)
   * @returns {Promise<Object>} Informações de validação
   */
  async validateWallet(address, coin = 'USDT', chain = 'BSC') {
    try {
      const response = await this.client.post('/api/payments/validate-wallet', {
        address,
        coin,
        chain
      });

      return {
        success: response.data.success,
        valid: response.data.valid,
        message: response.data.message,
        data: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        valid: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Criar ordem de compra
   * @param {string} profileId - ID do perfil
   * @param {number} amountUsdt - Quantidade em USDT
   * @returns {Promise<Object>} Dados da ordem
   */
  async createOrder(profileId, amountUsdt) {
    try {
      const response = await this.client.post('/api/payments/create-order', {
        profileId,
        amountUsdt: parseFloat(amountUsdt)
      });

      if (response.data.success) {
        return {
          success: true,
          order: response.data.order,
          paymentData: response.data.paymentData
        };
      } else {
        throw new Error(response.data.error || 'Erro ao criar ordem');
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Obter histórico de transações
   * @param {string} profileId - ID do perfil
   * @returns {Promise<Array>} Lista de transações
   */
  async getHistory(profileId) {
    try {
      const response = await this.client.get(`/api/payments/history/${profileId}`);

      if (response.data.success) {
        return {
          success: true,
          transactions: response.data.transactions
        };
      } else {
        throw new Error(response.data.error || 'Erro ao buscar histórico');
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        transactions: []
      };
    }
  }
}

// ============================================
// EXEMPLOS DE USO
// ============================================

(async () => {
  const ecopay = new EcoPayClient('http://localhost:3001');

  console.log('🚀 Exemplos de Uso - EcoPay Client\n');

  // Exemplo 1: Transferência entre contas Bybit
  console.log('📤 [Exemplo 1] Transferência entre contas Bybit');
  const result1 = await ecopay.transferBetweenAccounts('destinatario@example.com', 100);
  console.log('Resultado:', result1);
  console.log('');

  // Exemplo 2: Transferência Universal para sub-conta
  console.log('📤 [Exemplo 2] Transferência Universal (Sub-conta)');
  const result2 = await ecopay.universalTransfer('subaccount@example.com', 50, 'USDT', 'TRANSFER');
  console.log('Resultado:', result2);
  console.log('');

  // Exemplo 3: Transferência Universal com saque externo
  console.log('📤 [Exemplo 3] Transferência Universal (Saque)');
  const result3 = await ecopay.universalTransfer('external@example.com', 25, 'USDT', 'WITHDRAW');
  console.log('Resultado:', result3);
  console.log('');

  // Exemplo 4: Validar carteira
  console.log('✅ [Exemplo 4] Validação de Carteira');
  const result4 = await ecopay.validateWallet('0x8894E0a0c962CB723c1976aEd1D0F3Fe0b4C7f00', 'USDT', 'BSC');
  console.log('Resultado:', result4);
  console.log('');

  // Exemplo 5: Criar ordem
  console.log('🛒 [Exemplo 5] Criar Ordem');
  const result5 = await ecopay.createOrder('profile-uuid-here', 200);
  console.log('Resultado:', result5);
  console.log('');

  // Exemplo 6: Histórico
  console.log('📋 [Exemplo 6] Histórico de Transações');
  const result6 = await ecopay.getHistory('profile-uuid-here');
  console.log('Resultado:', result6);
})();

// ============================================
// EXPORTAR PARA USO EM OUTRAS APLICAÇÕES
// ============================================

module.exports = EcoPayClient;

// Uso em outra aplicação:
// const EcoPayClient = require('./ecopay-client');
// const ecopay = new EcoPayClient('https://ecopay-api.fly.dev');
// const result = await ecopay.transferBetweenAccounts('user@example.com', 100);
