const { RestClientV5 } = require('bybit-api');
require('dotenv').config();

class BybitService {
  constructor() {
    this.apiKey = process.env.BYBIT_API_KEY;
    this.apiSecret = process.env.BYBIT_API_SECRET;
    this.testnet = process.env.BYBIT_TESTNET === 'true';

    if (this.apiKey && this.apiSecret) {
      this.client = new RestClientV5({
        key: this.apiKey,
        secret: this.apiSecret,
        testnet: this.testnet,
        recv_window: 5000
      });
      console.log(`[Bybit] Service initialized ${this.testnet ? '(TESTNET)' : '(MAINNET)'}`);
    } else {
      console.warn('[Bybit] API credentials not configured.');
      this.client = null;
    }
  }

  /**
   * Saque/Transferência para endereço externo
   */
  async createWithdrawal(address, amount, coin = 'USDT', chain = 'BNB') {
    if (!this.client) {
      throw new Error('Bybit API não configurada');
    }

    try {
      console.log(`[Bybit] Iniciando saque: ${amount} ${coin} para ${address} (${chain})`);

      const response = await this.client.submitWithdrawal({
        coin,
        chain,
        address,
        amount: amount.toString(),
        accountType: 'UNIFIED',
        forceChain: 0,
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
   * Valida um endereço de carteira (por formato)
   */
  async validateAddress(address, coin = 'USDT', chain = 'BNB') {
    const chainPrefixes = { BNB: '0x', TRX: 'T', ETH: '0x' };
    const prefix = chainPrefixes[chain] || '';
    const isValid = prefix ? address.startsWith(prefix) && address.length > 10 : address.length > 10;
    console.log(`[Bybit] Validação de endereço: ${address} (${chain}) → ${isValid ? 'válido' : 'inválido'}`);
    return {
      success: true,
      valid: isValid,
      data: { isValid, address, chain }
    };
  }

  /**
   * Obtém histórico de saques
   */
  async getWithdrawalHistory(limit = 50) {
    if (!this.client) {
      throw new Error('Bybit API não configurada');
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
    if (!this.client) {
      throw new Error('Bybit API não configurada');
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
    if (!this.client) {
      throw new Error('Bybit API não configurada');
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
