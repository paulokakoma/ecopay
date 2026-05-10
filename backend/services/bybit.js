const { RestClientV5 } = require('bybit-api');
require('dotenv').config();

class BybitService {
  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
    this.testnet = process.env.BYBIT_TESTNET === 'true';
    this.useMock = process.env.MOCK_BYBIT === 'true';

    if (this.useMock) {
      console.log('[Bybit] Service initialized in MOCK mode (development)');
      this.client = null;
    } else if (this.apiKey && this.apiSecret) {
      this.client = new RestClientV5({
        key: this.apiKey,
        secret: this.apiSecret,
        testnet: this.testnet,
        recv_window: 5000 // 5 segundos (recomendado Bybit)
      });
      console.log(`[Bybit] Service initialized ${this.testnet ? '(TESTNET)' : '(MAINNET)'} ${this.useMock ? '(MOCK)' : '(REAL)'}`);
    } else {
      console.warn('[Bybit] API credentials not configured. Service is in read-only mode.');
      this.client = null;
    }
  }

  // MOCK: Gerar ID único
  _mockId() {
    return 'MOCK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Saque/Transferência para endereço externo
   */
  async createWithdrawal(address, amount, coin = 'USDT', chain = 'BNB') {
    // MODO MOCK: Simular saque em desenvolvimento
    if (this.useMock || !this.client) {
      console.log(`[MOCK] Saque simulado: ${amount} ${coin} para ${address} (${chain})`);
      return {
        success: true,
        data: {
          id: this._mockId(),
          status: 'Success',
          coin,
          chain,
          amount: amount.toString(),
          address
        },
        message: 'Saque simulado com sucesso (MOCK)'
      };
    }

    try {
      console.log(`[Bybit] Iniciando saque: ${amount} ${coin} para ${address} (${chain})`);

      const response = await this.client.submitWithdrawal({
        coin,
        chain,
        address,
        amount: amount.toString(),
        accountType: 'UNIFIED', // UTA accounts usam UNIFIED
        forceChain: 0, // 0 = permite off-chain se for endereço Bybit
      });

      if (response.retCode === 0) {
        console.log('[Bybit] Saque iniciado com sucesso. ID:', response.result?.id);
        return {
          success: true,
          data: response.result,
          message: 'Saque iniciado com sucesso'
        };
      } else {
        console.error('[Bybit] Erro no saque:', response.retMsg, '(Code:', response.retCode + ')');
        throw new Error(`Erro Bybit (${response.retCode}): ${response.retMsg}`);
      }
    } catch (error) {
      console.error('[Bybit] Withdrawal Error:', error.message);
      throw error;
    }
  }

  /**
   * Valida um endereço de carteira
   */
  async validateAddress(address, coin = 'USDT', chain = 'BNB') {
    // MODO MOCK
    if (this.useMock || !this.client) {
      console.log(`[MOCK] Validação de endereço: ${address}`);
      const isValid = address && address.length > 10;
      return {
        success: true,
        valid: isValid,
        data: { isValid, address, chain }
      };
    }

    try {
      console.log(`[Bybit] Validando endereço: ${address} (${coin} - ${chain})`);

      const response = await this.client.getWithdrawalAddressList({
        coin,
        chain,
        address
      });

      if (response.retCode === 0) {
        const isValid = response.result?.rows?.some(addr => addr.address === address) || false;
        console.log(`[Bybit] Endereço ${isValid ? 'válido' : 'inválido'}: ${address}`);

        return {
          success: true,
          valid: isValid,
          data: response.result
        };
      } else {
        throw new Error(`Erro Bybit (${response.retCode}): ${response.retMsg}`);
      }
    } catch (error) {
      console.error('[Bybit] Address Validation Error:', error.message);
      throw error;
    }
  }

  /**
   * Obtém histórico de saques
   */
  async getWithdrawalHistory(limit = 50) {
    // MODO MOCK
    if (this.useMock || !this.client) {
      console.log(`[MOCK] Histórico de saques (${limit} registros)`);
      return {
        success: true,
        data: [
          {
            id: this._mockId(),
            coin: 'USDT',
            amount: '2',
            chain: 'BNB',
            status: 'Success',
            createdAt: new Date().toISOString()
          }
        ]
      };
    }

    try {
      const response = await this.client.getWithdrawalRecords({ limit });

      if (response.retCode === 0) {
        return {
          success: true,
          data: response.result?.rows || []
        };
      } else {
        throw new Error(`Erro Bybit (${response.retCode}): ${response.retMsg}`);
      }
    } catch (error) {
      console.error('[Bybit] Withdrawal History Error:', error.message);
      throw error;
    }
  }

  /**
   * Obtém status de um saque específico
   */
  async getWithdrawalStatus(withdrawId) {
    // MODO MOCK
    if (this.useMock || !this.client) {
      console.log(`[MOCK] Status do saque: ${withdrawId}`);
      return {
        success: true,
        status: 'Success',
        data: { id: withdrawId, status: 'Success' }
      };
    }

    try {
      const response = await this.client.getWithdrawalRecords({
        withdrawID: withdrawId
      });

      if (response.retCode === 0 && response.result?.rows?.length > 0) {
        const withdrawal = response.result.rows[0];
        return {
          success: true,
          status: withdrawal.status,
          data: withdrawal
        };
      } else {
        throw new Error('Saque não encontrado');
      }
    } catch (error) {
      console.error('[Bybit] Withdrawal Status Error:', error.message);
      throw error;
    }
  }

  /**
   * Obtém saldo da conta
   */
  async getAccountBalance() {
    // MODO MOCK
    if (this.useMock || !this.client) {
      console.log('[MOCK] Saldo da conta (simulado)');
      return {
        success: true,
        walletBalance: '1000.00',
        transferBalance: '1000.00',
        coin: 'USDT',
        accountType: 'UNIFIED'
      };
    }

    try {
      const response = await this.client.getWalletBalance({
        accountType: 'UNIFIED'
      });

      if (response.retCode === 0) {
        const usdtAsset = response.result?.list?.[0]?.coin?.find(c => c.coin === 'USDT');

        return {
          success: true,
          walletBalance: usdtAsset?.walletBalance || '0',
          transferBalance: usdtAsset?.transferBalance || '0',
          coin: 'USDT',
          accountType: 'UNIFIED',
          data: response.result
        };
      } else {
        throw new Error(`Erro Bybit (${response.retCode}): ${response.retMsg}`);
      }
    } catch (error) {
      console.error('[Bybit] Account Balance Error:', error.message);
      throw error;
    }
  }

  /**
   * Testa conexão com a API
   */
  async testConnection() {
    try {
      const response = await this.getAccountBalance();
      console.log('[Bybit] Connection test:', response.success ? 'SUCCESS' : 'FAILED');
      return response.success;
    } catch (error) {
      console.error('[Bybit] Connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new BybitService();
