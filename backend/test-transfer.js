const bybit = require('./services/bybit');
const supabase = require('./services/supabase');

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890'; // Substitua por um endereço real na whitelist
const TEST_AMOUNT = '2'; // 2 USDT
const TEST_CHAIN = 'BNB'; // BSC/BEP20

async function testTransfer() {
  console.log('=== TESTE DE TRANSFERÊNCIA ECO-PAY ===\n');

  try {
    // 1. Verificar conexão
    console.log('1. Testando conexão com Bybit...');
    const isConnected = await bybit.testConnection();
    if (!isConnected) {
      throw new Error('Falha na conexão com Bybit. Verifique IP whitelist.');
    }
    console.log('✅ Conexão OK\n');

    // 2. Verificar saldo
    console.log('2. Verificando saldo...');
    const balance = await bybit.getAccountBalance();
    if (!balance.success) {
      throw new Error('Erro ao obter saldo');
    }
    console.log(`✅ Saldo disponível: ${balance.transferBalance} USDT\n`);

    if (parseFloat(balance.transferBalance) < parseFloat(TEST_AMOUNT)) {
      throw new Error(`Saldo insuficiente. Necessário: ${TEST_AMOUNT} USDT`);
    }

    // 3. Validar endereço (opcional, mas recomendado)
    console.log(`3. Validando endereço ${TEST_ADDRESS}...`);
    try {
      const validation = await bybit.validateAddress(TEST_ADDRESS, 'USDT', TEST_CHAIN);
      console.log(`✅ Endereço validado: ${validation.valid ? 'Válido' : 'Inválido'}\n`);
    } catch (valError) {
      console.log(`⚠️ Não foi possível validar (continuando): ${valError.message}\n`);
    }

    // 4. Executar transferência
    console.log(`4. Executando transferência de ${TEST_AMOUNT} USDT para ${TEST_ADDRESS} (${TEST_CHAIN})...`);
    const result = await bybit.createWithdrawal(TEST_ADDRESS, TEST_AMOUNT, 'USDT', TEST_CHAIN);

    if (result.success) {
      console.log('✅ Transferência iniciada com sucesso!');
      console.log('   ID:', result.data?.id || 'N/A');
      console.log('   Status: Processando...\n');

      // 5. Salvar no banco de dados (opcional para teste)
      console.log('5. Salvando no banco de dados...');
      const { data: tx, error } = await supabase
        .from('ecopay_transactions')
        .insert([{
          profile_id: '00000000-0000-0000-0000-000000000000', // UUID fictício para teste
          amount_usdt: parseFloat(TEST_AMOUNT),
          amount_aoa: parseFloat(TEST_AMOUNT) * 1200, // Taxa de câmbio padrão
          exchange_rate: 1200,
          network_fee: 1,
          payment_ref: `TEST-${Date.now()}`,
          payment_status: 'processing',
          bybit_withdraw_id: result.data?.id || 'N/A'
        }])
        .select();

      if (error) {
        console.log('⚠️ Erro ao salvar no banco:', error.message);
      } else {
        console.log('✅ Transação salva no banco:', tx[0]?.id);
      }

      console.log('\n=== TESTE CONCLUÍDO ===');
      console.log('Verifique o status no Bybit e use /check-pending-withdrawals para atualizar.');

    } else {
      throw new Error('Transferência falhou');
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    process.exit(1);
  }
}

testTransfer();
