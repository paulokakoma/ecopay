const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const bybit = require('../services/bybit');

// Constants (Should be in .env but using here for clarity)
const USDT_AOA_RATE = parseFloat(process.env.USDT_AOA_RATE || '1200');
const NETWORK_FEE = parseFloat(process.env.NETWORK_FEE_USDT || '1');

// NOVO: Teste de conexão com Bybit
router.get('/bybit-test', async (req, res) => {
  try {
    const isConnected = await bybit.testConnection();
    if (isConnected) {
      res.json({ 
        success: true, 
        message: 'Conexão com Bybit OK!',
        status: 'connected'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Falha ao conectar com Bybit',
        status: 'disconnected'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      status: 'error'
    });
  }
});

// NOVO: Obter saldo da carteira Bybit
router.get('/bybit-balance', async (req, res) => {
  try {
    const balance = await bybit.getAccountBalance();
    if (balance.success) {
      res.json({
        success: true,
        balance: balance.walletBalance,
        currency: balance.coin,
        data: balance
      });
    } else {
      res.status(400).json({ success: false, error: 'Erro ao obter saldo' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NOVO: Obter histórico de saques
router.get('/bybit-withdrawals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await bybit.getWithdrawalHistory(limit);
    
    if (history.success) {
      res.json({
        success: true,
        withdrawals: history.data,
        count: history.data.length
      });
    } else {
      res.status(400).json({ success: false, error: 'Erro ao obter histórico' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NOVO: Verificar status de um saque específico
router.get('/bybit-withdrawal-status/:withdrawId', async (req, res) => {
  try {
    const { withdrawId } = req.params;
    const status = await bybit.getWithdrawalStatus(withdrawId);
    
    res.json({
      success: true,
      status: status.status,
      data: status.data
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// EXISTENTE: Instant Withdraw (agora usando SDK oficial)
router.post('/instant-withdraw', async (req, res) => {
  try {
    const { address, amount, chain } = req.body;
    
    // Converter nomes de rede para padrão Bybit
    const chainMap = {
      'BSC': 'BNB',
      'TRC20': 'TRX',
      'BEP20': 'BNB',
      'ERC20': 'ETH'
    };
    
    const bybitChain = chainMap[chain] || chain || 'BNB';
    
    console.log(`[Payment] Executando saque instantâneo: ${amount} USDT para ${address} (${bybitChain})`);
    
    const result = await bybit.createWithdrawal(address, amount, 'USDT', bybitChain);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Saque processado com sucesso!', 
        data: result.data 
      });
    } else {
      res.status(400).json({ success: false, message: 'Erro no saque' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 1. Create Purchase Order
router.post('/create-order', async (req, res) => {
  try {
    const { profileId, amountUsdt } = req.body;

    // Verify profile is approved
    const { data: profile, error: profileError } = await supabase
      .from('ecopay_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || profile.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'User wallet not approved yet.' });
    }

    const totalAoa = (parseFloat(amountUsdt) + NETWORK_FEE) * USDT_AOA_RATE;

    // TODO: Call PayPay Africa API to generate Entity/Reference here
    const mockReference = `REF-${Math.floor(Math.random() * 90000) + 10000}`;
    const mockEntity = '90000';

    // Save transaction
    const { data: transaction, error: txError } = await supabase
      .from('ecopay_transactions')
      .insert([{
        profile_id: profileId,
        amount_usdt: amountUsdt,
        amount_aoa: totalAoa,
        exchange_rate: USDT_AOA_RATE,
        network_fee: NETWORK_FEE,
        payment_ref: mockReference,
        payment_status: 'awaiting_payment'
      }])
      .select();

    if (txError) throw txError;

    res.json({
      success: true,
      order: transaction[0],
      paymentData: {
        entity: mockEntity,
        reference: mockReference,
        amount: totalAoa
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Webhook for PayPay Africa Liquidation
router.post('/webhook/paypay', async (req, res) => {
  try {
    // TODO: Validate webhook signature from PayPay Africa
    const { reference, status } = req.body;

    if (status !== 'PAID') {
       return res.json({ success: true, message: 'Status not paid' });
    }

    // Find transaction
    const { data: tx, error: txError } = await supabase
      .from('ecopay_transactions')
      .select('*, ecopay_profiles(*)')
      .eq('payment_ref', reference)
      .single();

    if (txError || !tx) throw new Error('Transaction not found');

    if (tx.payment_status === 'liquidated') {
      return res.json({ success: true, message: 'Already liquidated' });
    }

    // Mark as paid
    await supabase.from('ecopay_transactions').update({ payment_status: 'paid_fiat' }).eq('id', tx.id);

    // EXECUTE BYBIT WITHDRAWAL
    console.log(`Executing Bybit withdraw to ${tx.ecopay_profiles.wallet_address}...`);
    const bybitChain = tx.ecopay_profiles.wallet_chain === 'BSC' ? 'BNB' :
                       tx.ecopay_profiles.wallet_chain === 'TRC20' ? 'TRX' :
                       tx.ecopay_profiles.wallet_chain;
    
    try {
      const withdrawResult = await bybit.createWithdrawal(
        tx.ecopay_profiles.wallet_address,
        tx.amount_usdt,
        'USDT',
        bybitChain
      );

      // Salvar ID do saque e marcar como processando
      const withdrawId = withdrawResult?.data?.id || withdrawResult?.data?.withdrawId || 'N/A';
      await supabase.from('ecopay_transactions').update({
        payment_status: 'processing',
        bybit_withdraw_id: withdrawId
      }).eq('id', tx.id);
      
      console.log(`[Webhook] Withdrawal ${withdrawId} initiated for tx ${tx.id}`);
    } catch (withdrawError) {
      console.error('[Webhook] Withdrawal failed:', withdrawError.message);
      await supabase.from('ecopay_transactions').update({
        payment_status: 'failed',
        bybit_withdraw_id: null
      }).eq('id', tx.id);
      throw withdrawError;
    }

    res.json({ success: true, message: 'Payment confirmed and USDT sent!' });

  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get transaction history for profile
router.get('/history/:profileId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ecopay_transactions')
      .select('*')
      .eq('profile_id', req.params.profileId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ success: true, transactions: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate wallet address using Bybit API
router.post('/validate-wallet', async (req, res) => {
  try {
    const { address, coin, chain } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, error: 'Endereço é obrigatório' });
    }

    // Verifica se deve usar simulação
    if (process.env.MOCK_BYBIT === 'true') {
      // Simulação para desenvolvimento
      const isValid = address.length > 10 && (address.startsWith('0x') || address.startsWith('T'));
      return res.json({
        success: true,
        valid: isValid,
        message: isValid ? 'Endereço válido (simulado)' : 'Endereço inválido (simulado)',
        data: { isValid }
      });
    }

    // Converter nome da rede para o padrão Bybit
    const chainMap = {
      'BSC': 'BNB',
      'TRC20': 'TRX',
      'BEP20': 'BNB',
      'ERC20': 'ETH'
    };
    
    const bybitChain = chainMap[chain] || chain || 'BNB';

    const result = await bybit.validateAddress(address, coin || 'USDT', bybitChain);

    if (result.success) {
      res.json({
        success: true,
        valid: result.valid,
        message: result.valid ? 'Endereço válido' : 'Endereço inválido',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        valid: false,
        error: 'Erro ao validar endereço'
      });
    }
  } catch (error) {
    console.error('Wallet validation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transferência entre contas Bybit via email
router.post('/transfer-bybit-account', async (req, res) => {
  try {
    const { recipientEmail, amount, coin = 'USDT' } = req.body;

    if (!recipientEmail || !amount) {
      return res.status(400).json({ success: false, error: 'Email e valor são obrigatórios' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valor deve ser maior que 0' });
    }

    console.log(`[Payment] Transferência entre contas: ${amount} ${coin} para ${recipientEmail}`);
    
    // ⚠️ NOTA: O SDK oficial bybit-api não suporta transferências internas via email
    // Para isso, você precisaria usar um dos métodos:
    // 1. Endpoint manual de transferência interna (se disponível para sua conta)
    // 2. Criar sub-contas e usar transferência entre contas-mãe e sub
    // 3. Usar saque com endereço Bybit (requer whitelist prévio)
    
    // Por enquanto, retornaremos um erro indicando a necessidade de configuração
    return res.status(400).json({ 
      success: false, 
      error: 'Transferência interna via email requer configuração adicional. Use /instant-withdraw para saques.',
      note: 'Entre em contato com Bybit support para ativar transferências internas.'
    });

  } catch (error) {
    console.error('Bybit transfer error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Verificar status de saques pendentes (atualiza no banco)
router.post('/check-pending-withdrawals', async (req, res) => {
  try {
    // Buscar transações com status 'processing' ou 'paid_fiat' que têm bybit_withdraw_id
    const { data: pendingTxs, error } = await supabase
      .from('ecopay_transactions')
      .select('*, ecopay_profiles(*)')
      .in('payment_status', ['processing', 'paid_fiat'])
      .not('bybit_withdraw_id', 'is', null)
      .limit(50);

    if (error) throw error;

    if (!pendingTxs || pendingTxs.length === 0) {
      return res.json({ success: true, message: 'Nenhum saque pendente', updated: 0 });
    }

    let updated = 0;
    const results = [];

    for (const tx of pendingTxs) {
      try {
        const status = await bybit.getWithdrawalStatus(tx.bybit_withdraw_id);
        
        if (status.success) {
          let newStatus = tx.payment_status;
          
          // Mapear status da Bybit para nosso sistema
          switch (status.status) {
            case 'Success':
              newStatus = 'liquidated';
              break;
            case 'Failed':
            case 'Cancel':
              newStatus = 'failed';
              break;
            case 'Pending':
              newStatus = 'processing';
              break;
          }

          if (newStatus !== tx.payment_status) {
            await supabase.from('ecopay_transactions').update({
              payment_status: newStatus
            }).eq('id', tx.id);
            updated++;
          }

          results.push({
            txId: tx.id,
            withdrawId: tx.bybit_withdraw_id,
            oldStatus: tx.payment_status,
            newStatus,
            bybitStatus: status.status
          });
        }
      } catch (err) {
        console.error(`Error checking withdrawal ${tx.bybit_withdraw_id}:`, err.message);
        results.push({
          txId: tx.id,
          withdrawId: tx.bybit_withdraw_id,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `${updated} saques atualizados`,
      checked: pendingTxs.length,
      updated,
      results
    });

  } catch (error) {
    console.error('Check pending withdrawals error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transferência Universal (Bybit to other exchanges/wallets)
router.post('/universal-transfer', async (req, res) => {
  try {
    const { recipient, amount, coin = 'USDT', type = 'WITHDRAW' } = req.body;

    if (!recipient || !amount) {
      return res.status(400).json({ success: false, error: 'Destinatário e valor são obrigatórios' });
    }

    if (!['TRANSFER', 'WITHDRAW'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Tipo inválido. Use TRANSFER ou WITHDRAW' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valor deve ser maior que 0' });
    }

    console.log(`[Payment] Transferência universal: ${amount} ${coin} para ${recipient} (${type})`);
    
    // Para tipo WITHDRAW, usar createWithdrawal
    if (type === 'WITHDRAW') {
      const result = await bybit.createWithdrawal(recipient, amount, coin, 'BNB');
      if (result.success) {
        res.json({
          success: true,
          message: 'Transferência iniciada com sucesso!',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Erro ao processar transferência'
        });
      }
    } else {
      // Para TRANSFER, seria necessário usar API interna de transferência
      res.status(400).json({
        success: false,
        error: 'Transferências internas requerem configuração. Use tipo WITHDRAW.'
      });
    }
  } catch (error) {
    console.error('Universal transfer error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
