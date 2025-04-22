const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
require('dotenv').config();

const trelloKey = process.env.TRELLO_API_KEY;
const trelloToken = process.env.TRELLO_TOKEN;
const boardId = process.env.TRELLO_BOARD_ID;
const listaRecebida = process.env.LISTA_MSG_RECEBIDA;
const listaEnviada = process.env.LISTA_MSG_ENVIADA;
const listaClientesResponderam = process.env.LISTA_CLIENTES_RESPONDERAM;
const contatoPatricia = process.env.CONTATO_PATRICIA;

const mensagensBoasVindas = [
  'Olá, seja bem-vindo(a)! Gostaríamos de entender melhor sua necessidade. Deseja mais fotos ou informações sobre o veículo?',
  'Oi! Obrigado pelo contato! Estou à disposição para mais detalhes e fotos do veículo que você escolheu. Como posso ajudar?',
  'Olá, tudo bem? Recebemos sua solicitação! Posso te enviar mais fotos ou esclarecer dúvidas sobre o veículo?'
];

const clientesAtendidos = new Set();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox']
  }
});

client.on('qr', qr => {
  console.log(`ESCANEIE O QR CODE ABAIXO PARA AUTENTICAR O WHATSAPP.`);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp conectado com sucesso!');
});

client.on('message', async message => {
  if (message.from === contatoPatricia) {
    const [nome, telefone, veiculo] = message.body.split('\n');
    let numeroFormatado = telefone.replace(/\D/g, '');

    if (nome && telefone && veiculo && !clientesAtendidos.has(numeroFormatado)) {
      clientesAtendidos.add(numeroFormatado);

      await criarCardTrello(listaRecebida, `Cliente: ${nome}`, `Telefone: ${telefone}\nVeículo: ${veiculo}`);

      const mensagemEnviar = mensagensBoasVindas[Math.floor(Math.random() * mensagensBoasVindas.length)];

      const enviarMensagem = async (numero) => {
        try {
          await sleep(25000); // Aguarda 25 segundos para evitar bloqueio
          await client.sendMessage(numero + '@c.us', mensagemEnviar);
          await criarCardTrello(listaEnviada, `Mensagem enviada para: ${nome}`, mensagemEnviar);
        } catch (error) {
          console.error('Falha ao enviar mensagem para:', numero);
        }
      };

      await enviarMensagem(numeroFormatado);

      if (numeroFormatado.length === 13 && numeroFormatado.startsWith('55') && numeroFormatado[4] === '9') {
        const numeroSemNove = numeroFormatado.slice(0,4) + numeroFormatado.slice(5);
        await enviarMensagem(numeroSemNove);
      }
    }
  } else if (!message.fromMe) {
    const numeroCliente = message.from.replace('@c.us', '').replace(/\D/g, '');

    const numeroClienteCom9 = numeroCliente.length === 12 ? numeroCliente.slice(0,4) + '9' + numeroCliente.slice(4) : numeroCliente;
    const numeroClienteSem9 = numeroCliente.length === 13 && numeroCliente[4] === '9'
      ? numeroCliente.slice(0,4) + numeroCliente.slice(5)
      : numeroCliente;

    if (clientesAtendidos.has(numeroCliente) || clientesAtendidos.has(numeroClienteCom9) || clientesAtendidos.has(numeroClienteSem9)) {
      const contatoCliente = await message.getContact();
      await criarCardTrello(listaClientesResponderam, `Resposta de ${contatoCliente.pushname || contatoCliente.number}`, message.body);
    }
  }
});

async function criarCardTrello(idLista, nomeCard, descricao) {
  const url = `https://api.trello.com/1/cards?key=${trelloKey}&token=${trelloToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idList: idLista,
      name: nomeCard,
      desc: descricao,
    })
  });

  if (!response.ok) {
    console.error('Erro ao criar card:', await response.text());
  } else {
    console.log('Card criado com sucesso:', nomeCard);
  }
}

client.initialize();
