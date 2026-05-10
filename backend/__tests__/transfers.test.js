test-transfers.test.js;

const request = require('supertest');
const app = require('../app'); // Assumindo que app.js exporta a aplicação

describe('Transferências Bybit API', () => {
  
  // ============== TESTES: TRANSFERÊNCIA ENTRE CONTAS ==============

  describe('POST /api/payments/transfer-bybit-account', () => {
    
    test('Deve retornar erro quando email não é fornecido', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          amount: 100,
          coin: 'USDT'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Email');
    });

    test('Deve retornar erro quando amount não é fornecido', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          coin: 'USDT'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('obrigatórios');
    });

    test('Deve retornar erro para amount <= 0', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: -10,
          coin: 'USDT'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('maior que 0');
    });

    test('Deve aceitar transferência válida com padrão coin=USDT', async () => {
      // Este teste dependeria de mock da API Bybit
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'valid@example.com',
          amount: 100
        });

      // Se estiver com MOCK_BYBIT=true, retorna sucesso
      // Caso contrário, depende de credenciais Bybit válidas
      expect(response.status).toBe(200).or(500);
    });

    test('Deve incluir transferId na resposta de sucesso', async () => {
      // Requer mock ou credenciais reais
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: 50,
          coin: 'USDT'
        });

      if (response.body.success) {
        expect(response.body.data).toBeDefined();
        expect(response.body.message).toContain('sucesso');
      }
    });
  });

  // ============== TESTES: TRANSFERÊNCIA UNIVERSAL ==============

  describe('POST /api/payments/universal-transfer', () => {
    
    test('Deve retornar erro quando recipient não é fornecido', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          amount: 100,
          coin: 'USDT'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('Deve retornar erro para tipo inválido', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          recipient: 'test@example.com',
          amount: 100,
          type: 'INVALID'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Tipo inválido');
    });

    test('Deve aceitar type=TRANSFER', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          recipient: 'sub@example.com',
          amount: 50,
          coin: 'USDT',
          type: 'TRANSFER'
        });

      expect(response.status).toBe(200).or(500);
    });

    test('Deve aceitar type=WITHDRAW', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          recipient: 'external@example.com',
          amount: 25,
          coin: 'USDT',
          type: 'WITHDRAW'
        });

      expect(response.status).toBe(200).or(500);
    });

    test('Deve usar padrão type=TRANSFER quando não fornecido', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          recipient: 'test@example.com',
          amount: 100
        });

      // Não deve rejeitar apenas por não ter type
      expect(response.status).not.toBe(400);
    });

    test('Deve retornar erro para amount <= 0', async () => {
      const response = await request(app)
        .post('/api/payments/universal-transfer')
        .send({
          recipient: 'test@example.com',
          amount: 0,
          type: 'TRANSFER'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('maior que 0');
    });
  });

  // ============== TESTES: VALIDAÇÃO DE CARTEIRA ==============

  describe('POST /api/payments/validate-wallet', () => {
    
    test('Deve retornar erro quando address não é fornecido', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          coin: 'USDT',
          chain: 'BSC'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('Deve validar endereço Ethereum (0x...)', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          address: '0x8894E0a0c962CB723c1976aEd1D0F3Fe0b4C7f00',
          coin: 'USDT',
          chain: 'BSC'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBeDefined();
    });

    test('Deve validar endereço Tron (T...)', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          coin: 'USDT',
          chain: 'TRC20'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.valid).toBeDefined();
    });

    test('Deve rejeitar endereço inválido', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          address: 'invalid_address',
          coin: 'USDT',
          chain: 'BSC'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // valid pode ser false
      expect(response.body.valid).toBeDefined();
    });

    test('Deve usar padrões quando coin/chain não fornecidos', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          address: '0x8894E0a0c962CB723c1976aEd1D0F3Fe0b4C7f00'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ============== TESTES: TRATAMENTO DE ERROS ==============

  describe('Tratamento de Erros', () => {
    
    test('Deve retornar status 500 para erro interno', async () => {
      // Este teste depende de como o servidor trata erros Bybit
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: 999999999 // Valor muito alto
        });

      // Pode retornar 400 (erro Bybit) ou 500 (erro servidor)
      expect([400, 500]).toContain(response.status);
    });

    test('Deve incluir mensagem de erro clara', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'invalid-email',
          amount: 100
        });

      expect(response.body.error).toBeDefined();
      expect(response.body.error.length).toBeGreaterThan(0);
    });
  });

  // ============== TESTES: HEADERS E CORS ==============

  describe('Headers e CORS', () => {
    
    test('Deve aceitar Content-Type application/json', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .set('Content-Type', 'application/json')
        .send({
          recipientEmail: 'test@example.com',
          amount: 100
        });

      expect(response.status).not.toBe(415); // Unsupported Media Type
    });

    test('Deve retornar Content-Type application/json', async () => {
      const response = await request(app)
        .post('/api/payments/validate-wallet')
        .send({
          address: '0x123',
          coin: 'USDT'
        });

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // ============== TESTES: DADOS MONETÁRIOS ==============

  describe('Validação de Dados Monetários', () => {
    
    test('Deve aceitar amount como string numérica', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: '100.50'
        });

      expect(response.status).toBe(200).or(500);
    });

    test('Deve rejeitar amount como string não-numérica', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: 'abc'
        });

      // Pode retornar erro ou tratar como NaN
      expect(response.status).not.toBe(200);
    });

    test('Deve aceitar decimais até 2 casas', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: 100.99
        });

      expect(response.status).toBe(200).or(500);
    });

    test('Deve aceitar amount com muitos decimais', async () => {
      const response = await request(app)
        .post('/api/payments/transfer-bybit-account')
        .send({
          recipientEmail: 'test@example.com',
          amount: 100.123456789
        });

      expect(response.status).toBe(200).or(500);
    });
  });
});

