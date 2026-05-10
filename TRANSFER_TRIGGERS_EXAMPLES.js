/**
 * Exemplos de Triggers para Transferências Automáticas
 * 
 * Este arquivo mostra como integrar transferências automáticas em diferentes
 * cenários de negócio no EcoPay.
 */

const bybit = require('./services/bybit');
const supabase = require('./services/supabase');

// ============================================
// CENÁRIO 1: Saque de Usuário
// ============================================

/**
 * Trigger: Usuário clica "Sacar" no dashboard
 * Fluxo: Frontend → /api/payments/instant-withdraw
 */

// backend/routes/payment.js (EXISTENTE)
const withdrawalExample = async (req, res) => {
  const { address, amount, chain } = req.body;
  
  try {
    // 1. Validar usuário autenticado
    const user = req.user; // Vindo de middleware de autenticação
    if (!user) throw new Error('Unauthorized');
    
    // 2. Validar saldo do usuário
    const userBalance = await supabase
      .from('ecopay_profiles')
      .select('balance_usdt')
      .eq('id', user.id)
      .single();
    
    if (userBalance.data.balance_usdt < amount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }
    
    // 3. Validar limite diário
    const todayWithdrawals = await supabase
      .from('ecopay_transactions')
      .select('amount_usdt')
      .eq('profile_id', user.id)
      .eq('transaction_type', 'withdrawal')
      .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
    
    const totalToday = todayWithdrawals.data.reduce((sum, t) => sum + t.amount_usdt, 0);
    const DAILY_LIMIT = 1000; // USDT
    
    if (totalToday + amount > DAILY_LIMIT) {
      return res.status(400).json({ 
        error: `Limite diário de ${DAILY_LIMIT} USDT excedido` 
      });
    }
    
    // 4. Executar saque na Bybit
    const result = await bybit.createWithdrawal(address, amount, 'USDT', chain);
    
    if (!result.success) throw new Error(result.error);
    
    // 5. Registrar na base de dados
    await supabase
      .from('ecopay_transactions')
      .insert({
        profile_id: user.id,
        transaction_type: 'withdrawal',
        amount_usdt: amount,
        destination_address: address,
        destination_chain: chain,
        bybit_withdraw_id: result.data.withdrawId,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    
    // 6. Debitar saldo do usuário (IMPORTANTE!)
    await supabase
      .from('ecopay_profiles')
      .update({ 
        balance_usdt: userBalance.data.balance_usdt - amount 
      })
      .eq('id', user.id);
    
    // 7. Retornar sucesso
    res.json({
      success: true,
      message: 'Saque iniciado',
      withdrawId: result.data.withdrawId,
      status: 'pending'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// CENÁRIO 2: Pagamento Automático (Receita)
// ============================================

/**
 * Trigger: Pagamento confirmado da PayPay Africa
 * Fluxo: Webhook PayPay → Credita saldo → Transferência automática
 */

const paymentReceivedTrigger = async (paymentRef, amountAOA) => {
  try {
    // 1. Encontrar transação
    const { data: transaction } = await supabase
      .from('ecopay_transactions')
      .select('*, ecopay_profiles(*)')
      .eq('payment_ref', paymentRef)
      .single();
    
    const amountUSDT = amountAOA / 1200; // Taxa de câmbio
    
    // 2. Creditar saldo na Bybit (se usar like conta principal)
    // Nota: Se você tiver conta-mãe com sub-contas, isso seria diferente
    
    // 3. Registrar como receita
    await supabase
      .from('ecopay_transactions')
      .update({ 
        status: 'credited',
        amount_usdt: amountUSDT
      })
      .eq('id', transaction.id);
    
    // 4. Atualizar saldo do usuário
    const { data: profile } = await supabase
      .from('ecopay_profiles')
      .select('balance_usdt')
      .eq('id', transaction.profile_id)
      .single();
    
    await supabase
      .from('ecopay_profiles')
      .update({ 
        balance_usdt: (profile.balance_usdt || 0) + amountUSDT 
      })
      .eq('id', transaction.profile_id);
    
    console.log(`[Payment] ${amountUSDT} USDT creditados para usuário ${transaction.profile_id}`);
    
    return { success: true, amountUSDT };
    
  } catch (error) {
    console.error('[Payment Trigger] Erro:', error.message);
    throw error;
  }
};

// ============================================
// CENÁRIO 3: Distribuição de Lucros/Dividendos
// ============================================

/**
 * Trigger: Cronjob diário distribui lucros aos usuários
 * Fluxo: Cronjob → Calcula quota → Transfere para cada usuário
 */

const distributeProfitsTrigger = async () => {
  try {
    console.log('[Cron] Iniciando distribuição de lucros...');
    
    // 1. Obter saldo total disponível
    const balance = await bybit.getAccountBalance();
    const availableUSDT = parseFloat(balance.walletBalance);
    
    // 2. Calcular quota por usuário (proporção ao investimento)
    const { data: profiles } = await supabase
      .from('ecopay_profiles')
      .select('id, invested_amount, wallet_address, wallet_chain')
      .eq('status', 'approved');
    
    const totalInvested = profiles.reduce((sum, p) => sum + p.invested_amount, 0);
    const profitToDistribute = availableUSDT * 0.1; // 10% dos lucros
    
    // 3. Distribuir para cada usuário
    for (const profile of profiles) {
      const userQuota = (profile.invested_amount / totalInvested) * profitToDistribute;
      
      if (userQuota < 0.01) continue; // Ignora valores muito pequenos
      
      try {
        // 4. Executar transferência
        const result = await bybit.createWithdrawal(
          profile.wallet_address,
          userQuota,
          'USDT',
          profile.wallet_chain
        );
        
        // 5. Registrar distribuição
        await supabase
          .from('ecopay_transactions')
          .insert({
            profile_id: profile.id,
            transaction_type: 'profit_distribution',
            amount_usdt: userQuota,
            destination_address: profile.wallet_address,
            bybit_withdraw_id: result.data.withdrawId,
            status: 'pending'
          });
        
        console.log(`[Distribution] ${userQuota} USDT → ${profile.id}`);
        
      } catch (error) {
        console.error(`[Distribution] Erro ao transferir para ${profile.id}:`, error.message);
        // Continua com próximo usuário
      }
    }
    
    console.log('[Cron] Distribuição completa');
    
  } catch (error) {
    console.error('[Cron] Erro na distribuição:', error.message);
  }
};

// ============================================
// CENÁRIO 4: Saque Automático de Recompensas
// ============================================

/**
 * Trigger: Usuário acumula recompensas suficientes
 * Fluxo: Novo saldo registrado → Verifica limite → Saque automático
 */

const autoWithdrawRewardsTrigger = async (userId, rewardAmount) => {
  try {
    // 1. Obter configurações do usuário
    const { data: user } = await supabase
      .from('ecopay_profiles')
      .select('wallet_address, wallet_chain, auto_withdraw_threshold')
      .eq('id', userId)
      .single();
    
    // 2. Verificar se está acima do threshold
    const { data: totalRewards } = await supabase
      .from('ecopay_rewards')
      .select('amount')
      .eq('profile_id', userId)
      .eq('status', 'pending');
    
    const totalAmount = totalRewards.reduce((sum, r) => sum + r.amount, 0);
    
    if (totalAmount < (user.auto_withdraw_threshold || 10)) {
      console.log(`[Rewards] ${userId}: ${totalAmount} USDT, aguardando ${user.auto_withdraw_threshold} USDT`);
      return;
    }
    
    // 3. Executar saque automático
    const result = await bybit.createWithdrawal(
      user.wallet_address,
      totalAmount,
      'USDT',
      user.wallet_chain
    );
    
    // 4. Marcar recompensas como sacadas
    await supabase
      .from('ecopay_rewards')
      .update({ status: 'withdrawn' })
      .eq('profile_id', userId)
      .eq('status', 'pending');
    
    // 5. Registrar transação
    await supabase
      .from('ecopay_transactions')
      .insert({
        profile_id: userId,
        transaction_type: 'reward_withdrawal',
        amount_usdt: totalAmount,
        destination_address: user.wallet_address,
        bybit_withdraw_id: result.data.withdrawId,
        status: 'pending',
        notes: 'Saque automático de recompensas'
      });
    
    console.log(`[Auto-Withdraw] ${totalAmount} USDT sacados automaticamente para ${userId}`);
    
  } catch (error) {
    console.error('[Auto-Withdraw] Erro:', error.message);
  }
};

// ============================================
// CENÁRIO 5: Processamento em Lote (Batch)
// ============================================

/**
 * Trigger: Admin clica "Processar saques em lote"
 * Fluxo: Seleciona múltiplos saques → Processa em paralelo com rate limiting
 */

const batchWithdrawalTrigger = async (withdrawalIds) => {
  try {
    console.log(`[Batch] Processando ${withdrawalIds.length} saques...`);
    
    const results = {
      success: [],
      failed: []
    };
    
    // Processa com rate limiting (máx 2 requisições por segundo)
    for (let i = 0; i < withdrawalIds.length; i += 2) {
      const batch = withdrawalIds.slice(i, i + 2);
      
      const promises = batch.map(async (id) => {
        try {
          // Obter detalhes do saque
          const { data: withdrawal } = await supabase
            .from('ecopay_withdrawal_requests')
            .select('*, ecopay_profiles(*)')
            .eq('id', id)
            .single();
          
          // Executar transferência
          const result = await bybit.createWithdrawal(
            withdrawal.destination_address,
            withdrawal.amount,
            'USDT',
            withdrawal.chain
          );
          
          // Atualizar status
          await supabase
            .from('ecopay_withdrawal_requests')
            .update({ 
              status: 'processed',
              bybit_withdraw_id: result.data.withdrawId
            })
            .eq('id', id);
          
          results.success.push(id);
          console.log(`[Batch] ✅ ${id}`);
          
        } catch (error) {
          results.failed.push({ id, error: error.message });
          console.log(`[Batch] ❌ ${id}: ${error.message}`);
        }
      });
      
      await Promise.all(promises);
      
      // Aguarda 500ms antes da próxima batch (rate limiting)
      if (i + 2 < withdrawalIds.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('[Batch] Erro geral:', error.message);
    throw error;
  }
};

// ============================================
// CENÁRIO 6: Verificação Periódica de Status
// ============================================

/**
 * Trigger: Cronjob a cada 5 minutos verifica status de saques
 * Fluxo: Obtém status na Bybit → Atualiza BD → Notifica usuário
 */

const statusCheckTrigger = async () => {
  try {
    // 1. Obter saques pendentes
    const { data: pendingWithdrawals } = await supabase
      .from('ecopay_transactions')
      .select('id, bybit_withdraw_id, profile_id')
      .eq('status', 'pending')
      .limit(100);
    
    for (const withdrawal of pendingWithdrawals) {
      try {
        // 2. Verificar status na Bybit
        const status = await bybit.getWithdrawalStatus(withdrawal.bybit_withdraw_id);
        
        // 3. Atualizar banco de dados
        let newStatus = 'pending';
        if (status.status === 'success') newStatus = 'completed';
        if (status.status === 'failed') newStatus = 'failed';
        
        await supabase
          .from('ecopay_transactions')
          .update({ status: newStatus })
          .eq('id', withdrawal.id);
        
        // 4. Notificar usuário se mudou status
        if (newStatus !== 'pending') {
          await supabase
            .from('ecopay_notifications')
            .insert({
              profile_id: withdrawal.profile_id,
              type: 'withdrawal_' + newStatus,
              message: `Seu saque foi ${newStatus === 'completed' ? 'concluído' : 'falhou'}`,
              read: false
            });
          
          console.log(`[Status Check] Notificação enviada para ${withdrawal.profile_id}`);
        }
        
      } catch (error) {
        console.error(`[Status Check] Erro ao verificar ${withdrawal.id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('[Status Check] Erro geral:', error.message);
  }
};

// ============================================
// INTEGRAÇÃO NO APP PRINCIPAL
// ============================================

// backend/app.js

const app = require('express')();

// Inicializar triggers automáticos

// Distribuição de lucros: toda madrugada às 2:00 AM
const cron = require('node-cron');

cron.schedule('0 2 * * *', distributeProfitsTrigger);
console.log('[Cron] Distribuição de lucros agendada para 02:00 AM');

// Verificação de status: a cada 5 minutos
cron.schedule('*/5 * * * *', statusCheckTrigger);
console.log('[Cron] Verificação de status agendada a cada 5 minutos');

// ============================================
// EXPORTAR PARA USO
// ============================================

module.exports = {
  paymentReceivedTrigger,
  distributeProfitsTrigger,
  autoWithdrawRewardsTrigger,
  batchWithdrawalTrigger,
  statusCheckTrigger
};

// ============================================
// EXEMPLOS DE USO
// ============================================

/*

// 1. Ao receber pagamento via webhook PayPay
app.post('/webhook/paypay', async (req, res) => {
  const { reference, status } = req.body;
  
  if (status === 'PAID') {
    await paymentReceivedTrigger(reference, 600); // 600 AOA
  }
  
  res.json({ success: true });
});

// 2. Admin dispara distribuição manual
app.post('/admin/distribute-profits', async (req, res) => {
  const result = await distributeProfitsTrigger();
  res.json({ success: true, message: 'Distribuição iniciada' });
});

// 3. Admin processa saques em lote
app.post('/admin/batch-process', async (req, res) => {
  const { withdrawalIds } = req.body;
  const results = await batchWithdrawalTrigger(withdrawalIds);
  res.json(results);
});

// 4. Recompensa é creditada e pode gatilhar saque automático
app.post('/users/reward', async (req, res) => {
  const { userId, amount } = req.body;
  
  await creditReward(userId, amount);
  await autoWithdrawRewardsTrigger(userId, amount);
  
  res.json({ success: true });
});

*/
