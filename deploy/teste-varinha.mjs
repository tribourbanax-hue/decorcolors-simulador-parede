/* Teste da correção de 19/09 no simulador de parede.
 *
 * A REGRA QUE ELE TRAVA: seleção que pega quase a foto toda tem que ser
 * DESFEITA, não só avisada. Antes, o aviso aparecia com a foto já pintada
 * errada e quem estava na tela tinha que desfazer na mão.
 *
 * O teste EXTRAI a função do HTML que vai ser publicado, em vez de ter uma
 * cópia dela aqui: se alguém reescrever a função, é o código novo que roda.
 */
import fs from 'node:fs';

const arquivo = process.argv[2] || 'index-novo.html';
// A página publicada é CRLF; um regex ancorado em quebra de linha simples
// não acharia nada nela.
const html = fs.readFileSync(arquivo, 'utf8').split('\r\n').join('\n');
const achou = html.match(/function descartaSelecaoGrande[\s\S]*?\n}\n/);
if (!achou) {
  console.error(`FALHA: descartaSelecaoGrande não está em ${arquivo}`);
  process.exit(1);
}

let falhas = 0;
const ok = (nome, cond, detalhe = '') => {
  console.log(cond ? `  [ok]    ${nome}` : `  [FALHA] ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!cond) falhas++;
};

/* Monta o estado como ele está no instante em que o dedo solta: o arrasto da
 * varinha JÁ aplicou a seleção candidata na máscara (é isso que faz a
 * pré-visualização ao vivo), e `antes` é a base fixa de onde o arrasto parte. */
function cenario(fracao, undosEmpilhados = 1) {
  const N = 10000;
  const antes = new Uint8ClampedArray(N);
  for (let i = 0; i < 1000; i++) antes[i] = 255;     // 10% já estava marcado

  const candidata = new Uint8ClampedArray(N);
  for (let i = 0; i < Math.round(N * fracao); i++) candidata[i] = 255;

  const area = {
    mask: Uint8ClampedArray.from(candidata),
    rev: 0,
    _undo: Array.from({ length: undosEmpilhados }, () => new Uint8ClampedArray(N)),
  };

  const visto = { render: 0, invalidate: 0, botoes: 0, status: null };
  const fn = new Function(
    'activeArea', 'touch', 'invalidatePaint', 'renderComposite',
    'updateProjButtons', 'setStatus',
    achou[0] + '; return descartaSelecaoGrande;'
  )(
    () => area,
    (a) => { a.rev++; },
    () => { visto.invalidate++; },
    () => { visto.render++; },
    () => { visto.botoes++; },
    (t, k) => { visto.status = { t, k }; }
  );

  return { fn, area, antes, candidata, visto };
}

const igual = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

console.log(`\nlendo a função de: ${arquivo}`);

console.log('\n=== SELEÇÃO GRANDE DEMAIS (97% da foto) ===');
{
  const c = cenario(0.97);
  const r = c.fn(c.candidata, c.antes);
  ok('devolve true, pra quem chamou parar ali', r === true);
  ok('a máscara volta a ser a de ANTES do toque', igual(c.area.mask, c.antes));
  ok('a tela é redesenhada, agora sem a pintura errada', c.visto.render === 1);
  ok('o undo empilhado no toque é jogado fora', c.area._undo.length === 0);
  ok('avisa em vermelho', c.visto.status?.k === 'err');
  ok('e o aviso diz que DESFEZ, não só que era grande',
     /desfiz/i.test(c.visto.status?.t || ''),
     (c.visto.status?.t || '').slice(0, 70));
}

console.log('\n=== SELEÇÃO NORMAL (40% da foto) ===');
{
  const c = cenario(0.40);
  const comoEstava = Uint8ClampedArray.from(c.area.mask);
  const r = c.fn(c.candidata, c.antes);
  ok('devolve false — o fluxo normal segue', r === false);
  ok('não mexe na máscara', igual(c.area.mask, comoEstava));
  ok('não redesenha nada', c.visto.render === 0);
  ok('não gasta o undo', c.area._undo.length === 1);
  ok('não mostra aviso', c.visto.status === null);
}

console.log('\n=== NA BORDA DO LIMITE ===');
{
  const a = cenario(0.92);
  ok('exatamente 92% ainda passa', a.fn(a.candidata, a.antes) === false);
  const b = cenario(0.93);
  ok('93% já é descartado', b.fn(b.candidata, b.antes) === true);
}

console.log('\n=== HISTÓRICO VAZIO (não pode quebrar) ===');
{
  const c = cenario(0.97, 0);
  let erro = null;
  try { c.fn(c.candidata, c.antes); } catch (e) { erro = e; }
  ok('não estoura sem undo empilhado', erro === null, String(erro));
  ok('e mesmo assim restaura a máscara', igual(c.area.mask, c.antes));
}

console.log('\n' + '='.repeat(58));
if (falhas) { console.log(`  ${falhas} FALHA(S)`); process.exit(1); }
console.log('  Correção da varinha: tudo passou.');
