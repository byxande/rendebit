# Zest Protocol: como o protocolo consegue pagar juros ou rendimento em BTC?

**Data de referência:** 13 de setembro de 2026  
**Escopo:** mecanismo econômico e técnico do Zest Protocol, com comparação arquitetural com o fluxo RendeBit indicado no pedido.  
**Natureza do documento:** análise factual e técnica; não constitui recomendação de investimento.

## Resposta curta

O Zest **não cria BTC do nada e não paga automaticamente BTC nativo a partir de qualquer depósito**. Há, principalmente, duas fontes econômicas diferentes:

1. **Lending no Stacks Market:** o usuário fornece **sBTC**, que é uma representação SIP-010 de BTC na rede Stacks, e recebe cotas `zsBTC`. Tomadores pagam juros sobre os empréstimos de sBTC. Depois de reservar uma parcela para o tesouro, o contrato aumenta o índice de liquidez do vault; por isso, cada cota pode resgatar mais sBTC. O “rendimento em BTC” é, nessa rota, **juros de tomadores denominados em sBTC**, não uma transferência direta de BTC nativo na rede Bitcoin. [1] [2] [3]

2. **Vault estratégico `zvstBTC`:** o usuário deposita ou converte para **stBTC**, uma representação líquida de posições de Bitcoin Staking. O vault usa stBTC como colateral, toma sBTC emprestado no Zest, converte/estaca esse sBTC em mais stBTC via Stacking DAO e repete a operação dentro dos limites de risco. O rendimento bruto subjacente vem das recompensas de **Bitcoin Staking em PoX-5**, incorporadas à relação de valor do stBTC; a alavancagem amplia a exposição, mas também cria juros de dívida, risco de liquidação e outros custos. O alvo divulgado de 6–8% APY é variável, não garantido. [4] [5] [6]

Existe ainda um terceiro componente, que não deve ser confundido com a origem orgânica do BTC: um programa anunciado de incentivos com orçamento equivalente a **0,5 BTC por mês, pago em STX**, e não em BTC ou sBTC. Portanto, ele pode complementar o retorno medido em BRL ou BTC após conversão, mas não é produção nativa de BTC pelo mercado de lending. O anúncio usa linguagem de plano/proposta, sem provar todos os pagamentos ou a fórmula final. [7]

## 1. O que significa “rendimento em BTC” no Zest

A frase de marketing “earn up to 3% APY in BTC” reúne produtos e unidades de conta diferentes. A home também apresenta aproximadamente 1,5% APY para depósitos no Stacks Market, enquanto o vault `zvstBTC` tem alvo de 6–8% APY. Esses números não são uma taxa única nem uma promessa de retorno. Eles dependem de utilização, demanda de empréstimos, taxa de staking, custos de financiamento, liquidez, incentivos, parâmetros de risco e taxas. [1] [4] [8]

Para evitar ambiguidade, este relatório usa a seguinte distinção:

| Termo | Significado operacional no relatório | O que o usuário efetivamente recebe ou possui |
|---|---|---|
| **BTC nativo** | BTC controlado por UTXOs na rede Bitcoin, sem ser um token SIP-010 em Stacks | BTC na rede Bitcoin; não é diretamente o ativo subjacente do `v0-vault-sbtc` |
| **sBTC** | Token SIP-010 em Stacks com alvo de representação 1:1 do BTC, emitido e queimado pelo sistema de peg da Stacks | Um saldo fungível em Stacks que pode entrar no lending do Zest e, segundo as regras do peg, voltar a BTC |
| **stBTC** | Token líquido de exposição a Bitcoin Staking, operado pela Stacking DAO | Uma representação cuja relação com sBTC aumenta quando as recompensas de staking são incorporadas |
| **ztoken**, por exemplo `zsBTC` | Cota de participação em um vault de ativo único do Zest | Direito econômico sobre o ativo do vault, sujeito a índice de liquidez, liquidez disponível e perdas |
| **zvstBTC** | Share token do vault estratégico alavancado de Bitcoin Staking | Participação no NAV do vault, que contém ativos e passivos e pode subir ou cair |
| **BTCz** | Representação de um produto histórico de rendimento baseado em Babylon | Produto descontinuado ou em fase de encerramento desde julho de 2025; não deve ser tratado como produto atual confirmado |

A documentação oficial da Stacks descreve sBTC como token SIP-010 que representa BTC em proporção 1:1 e pode retornar a BTC pelo processo de withdrawal. Isso não significa que cada unidade de sBTC seja uma transferência direta de BTC nativo dentro do contrato do Zest. O Zest recebe o token sBTC já emitido em Stacks; o peg, os signers e os UTXOs Bitcoin pertencem à infraestrutura sBTC da Stacks. [9] [10]

## 2. Mecanismo econômico e técnico, passo a passo

### 2.1 Rota A — fornecedor de sBTC no Stacks Market

A rota mais simples para responder à pergunta é um fornecedor depositando sBTC em um vault de lending.

**Passo 1 — entrada do BTC.** O usuário começa com BTC nativo ou já possui sBTC. Se começa com BTC, faz o peg-in da Stacks: envia BTC para o endereço Bitcoin indicado, notifica o sistema e, após o processamento pelos signers, recebe sBTC em Stacks. O usuário assume nessa etapa os riscos do peg, do conjunto de signers, da disponibilidade operacional e do tempo de confirmação. [9] [10] [11]

**Passo 2 — depósito no vault.** O usuário deposita sBTC no `v0-vault-sbtc`. O contrato faz o accrual dos índices, verifica pausa, inicialização, slippage e supply cap, recebe o sBTC e emite `zsBTC`. O ztoken representa uma fração do vault; seu valor aumenta quando o índice de liquidez aumenta. [2] [12]

**Passo 3 — demanda de crédito.** Outro usuário fornece colateral elegível no mercado e toma sBTC emprestado, sujeito ao LTV, ao Risk Group, ao debt cap e aos demais parâmetros. O contrato `v0-8-market` consulta preços, valida a saúde da posição e chama a função de empréstimo do vault de sBTC. A dívida é armazenada em escala e cresce conforme o borrow index. [13] [14] [15]

**Passo 4 — juros.** O tomador deve devolver principal mais juros. O vault calcula a taxa de empréstimo a partir da utilização, definida como dívida dividida pela soma entre dívida e liquidez disponível. A curva é configurável e interpolada entre pontos de utilização e taxa. Quanto maior a utilização, em geral maior a taxa de borrow e menor a liquidez imediatamente disponível para resgates. [3] [16]

**Passo 5 — distribuição contábil.** O contrato aplica o reserve factor. Na configuração mainnet documentada para sBTC, o reserve factor é de 10%; assim, antes de arredondamento e composição, a taxa de liquidez implícita é aproximadamente:

```text
rendimento bruto do supplier ≈ taxa de borrow × utilização × (1 − reserve factor)
```

O juro reservado pode ser convertido em cotas para o `dao-treasury`; o restante é refletido no liquidity index e aumenta o valor econômico das cotas dos fornecedores. Portanto, o pagamento ao fornecedor ocorre por **valorização/resgate de `zsBTC` em mais sBTC**, e não necessariamente por uma transferência periódica separada. [2] [3] [12]

**Exemplo paramétrico, não cotação.** A curva publicada para sBTC contém, entre outros pontos, 60% de utilização a 8% APR e 80% a 9% APR. Em 80% de utilização, a aproximação simples seria `9% × 80% × 90% = 6,48% APR` para os fornecedores. Em 70%, a interpolação entre os dois pontos dá 8,5% APR de borrow e aproximadamente `8,5% × 70% × 90% = 5,355% APR`. Esses cálculos não representam o APY realizado em 13/09/2026, porque utilização, composição, reservas, perdas e parâmetros podem mudar. [3]

**Passo 6 — resgate.** O fornecedor que queima `zsBTC` recebe o subjacente, sujeito a saldo de ztokens, slippage, pausa e liquidez disponível. Se grande parte do sBTC estiver emprestada, o resgate pode não ser imediatamente atendido. O juro acumulado também não elimina risco de perda: `socialize-debt` permite distribuir dívida ruim entre fornecedores, reduzindo o índice de liquidez. [12] [17]

### 2.2 O que o tomador paga, e o que não paga

O tomador paga a obrigação definida pelo borrow index. Ele não está necessariamente pagando BTC nativo ao fornecedor. Se o ativo de dívida é sBTC, a dívida é contabilizada e liquidada em sBTC. O colateral pode ser STX, stSTX, stBTC, um ztoken ou outro ativo habilitado pelo registro e pelo Risk Group.

A arquitetura V2 separa o contrato central de mercado, o registro de ativos, os grupos de risco, o armazenamento das posições e os vaults de ativo único. O mercado coordena o fluxo; o vault de sBTC administra liquidez, dívida e índices de juros; o `market-vault` mantém máscaras de colateral e dívida. [13] [14] [15]

Um depósito usado como **colateral direto não-rehipotecado** não é automaticamente fornecido ao pool de empréstimos e, portanto, não recebe supply yield. Na rota de `supply-collateral-add`, o usuário recebe ztokens e registra essas cotas como colateral; nesse caso, as cotas podem continuar acumulando rendimento, mas permanecem expostas à liquidez e ao risco do vault. [13] [18]

### 2.3 Rota B — `zvstBTC`, staking e alavancagem

O `zvstBTC` é diferente de simplesmente fornecer sBTC ao lending market.

1. O usuário deposita stBTC diretamente, ou segue uma rota que converte sBTC em stBTC via Stacking DAO, ou parte de BTC que primeiro passa pelo peg para sBTC e depois pelo fluxo de staking.
2. O vault registra a participação em shares `zvstBTC` e calcula o NAV como ativos menos passivos.
3. A estratégia deposita stBTC como colateral no Stacks Market.
4. Toma sBTC emprestado.
5. Converte ou deposita o sBTC em mais stBTC pela Stacking DAO.
6. Repete o ciclo dentro dos limites de alavancagem e risco.
7. Na saída, o usuário passa por request, cooldown, funding e claim; o pagamento documentado é em stBTC. Quem deseja sBTC precisa resgatar stBTC conforme o processo da Stacking DAO. [4] [5]

A fonte bruta do rendimento não é o empréstimo em si. O empréstimo cria **exposição adicional** ao ativo de staking. O rendimento subjacente vem das recompensas de Bitcoin Staking em PoX-5: BTC comprometido por mineradores gera a economia de recompensas do protocolo; as recompensas do bond são acumuladas em sBTC e aumentam a relação econômica do stBTC. [6] [19] [20]

A alavancagem pode melhorar o retorno sobre o capital próprio quando o rendimento de staking supera o custo do sBTC tomado. Ela também pode destruir valor quando a taxa de borrow sobe, quando a recompensa cai, quando ocorre liquidação ou quando a conversão/saída fica ilíquida. O exemplo de aproximadamente 1 stBTC se transformar em uma posição próxima de 2 stBTC com aproximadamente 1 sBTC de dívida é uma ilustração simplificada, não um retorno fixo nem uma alavancagem garantida. [5]

### 2.4 Incentivos em STX não são juros BTC

O anúncio de 11 de setembro de 2026 descreve um plano de incentivos com orçamento mensal equivalente a 0,5 BTC, financiado pelo Stacks Endowment e pago em STX. A verba seria dividida entre supply simples de sBTC e empréstimos elegíveis de USDCx, com estimativa de aproximadamente 0,6% APY para supply de sBTC quando combinada com juros orgânicos. [7]

Esse mecanismo deve ser separado em três camadas:

- **Juro orgânico:** pago/acumulado pelos tomadores em sBTC.
- **Recompensa de staking:** incorporada à economia do stBTC por Bitcoin Staking.
- **Subsídio:** STX distribuído por um programa externo ou de incentivo; só vira exposição a BTC depois de conversão e continua sujeito a preço, liquidez e execução do programa.

O texto do anúncio usa linguagem de plano/proposta. Não há, nas fontes consultadas, contrato, calendário completo, fórmula final pro rata ou confirmação independente de que todas as parcelas tenham sido pagas. Logo, o incentivo não deve ser somado automaticamente a uma taxa líquida realizada.

### 2.5 Rota C — Bitcoin Collateral Vaults

Nos Bitcoin Collateral Vaults, o usuário deposita BTC em um vault Taproot individual na rede Bitcoin e pode tomar stablecoins em uma cadeia conectada. A proposta é que o BTC permaneça no Bitcoin L1 e não seja embrulhado para entrar no mercado de crédito. Cada posição teria seu próprio vault, sem pooling/commingling. [21]

Essa rota responde a outra pergunta econômica: **como tomar empréstimo contra BTC nativo**. Ela não demonstra, por si só, como pagar juros ou rendimento em BTC ao depositante. O juro poderia existir no mercado de stablecoins conectado, mas não deve ser confundido com supply yield de sBTC ou com o staking yield do `zvstBTC`.

Há uma ressalva importante de status. A documentação menciona protótipo mainnet e aceleração do deployment, enquanto o site marca “Launching in 2026” e a timeline fala em Bitcoin market “coming soon”. A documentação técnica também descreve Fase 1 com transações pré-assinadas, watchtowers e guardian council, deixando BitVM como Fase 2 ainda não pronta para produção. Assim, não é possível afirmar que uma oferta pública ampla, permissionless e sem pressupostos de confiança esteja operacional na data de referência. [21] [22]

## 3. Tabela consolidada dos fluxos

| Fluxo | Ativo na entrada | Onde o ativo circula | Fonte econômica do retorno | Unidade do retorno | Principal risco específico |
|---|---|---|---|---|---|
| Supply simples | BTC nativo convertido em sBTC | Peg Stacks e depois `v0-vault-sbtc` em Stacks | Juros pagos por tomadores de sBTC, menos reserva e perdas | sBTC via valorização de `zsBTC` | Peg/signer set, utilização, liquidez, bad debt e smart contract |
| Supply com colateral | sBTC ou outro ativo habilitado | Vault de ativo e `market-vault` | Juros somente se o depósito for rota de supply yield; colateral direto não rehipotecado não rende | ztoken e subjacente no resgate | Confundir garantia de colateral com fornecimento remunerado |
| `zvstBTC` | stBTC, ou sBTC/BTC por rotas de conversão | Stacking DAO, `v0-8-market`, vault estratégico | Recompensas de Bitcoin Staking, ampliadas pela alavancagem | Apreciação do NAV e resgate em stBTC | Custo de borrow, liquidação, relação stBTC/sBTC, cooldown e liquidez |
| Incentivos anunciados | Supply/borrow elegível | Programa de incentivos ligado ao Stacks Market | Subsídio financiado externamente | STX, não BTC/sBTC | Execução, fórmula, duração, preço e liquidez do STX |
| Bitcoin Collateral Vault | BTC nativo | Bitcoin L1 e cadeia de dívida conectada | Não há rendimento BTC demonstrado apenas pelo depósito; o BTC serve de colateral | BTC permanece no vault; stablecoin é a dívida | Status de produção, watchtowers, council, timelocks e settlement |
| Produto histórico BTCz | BTC/staking histórico | Stacks e Babylon | Rendimento do desenho histórico do pool | BTCz/sBTC conforme encerramento | Produto deprecated; não usar como taxa atual |

## 4. Rendimento bruto versus líquido

### 4.1 Lending de sBTC

Uma forma útil de representar o retorno de um fornecedor é:

```text
retorno líquido do supplier em sBTC
≈ juros pagos pelos tomadores
− reserva do DAO
− perdas por bad debt/socialização
− custos de entrada/saída e slippage
+ incentivos convertidos para sBTC, se efetivamente pagos
```

O `sBTC` fornecido não cresce porque o Zest tenha uma reserva automática de BTC. Ele cresce porque a contabilidade do vault incorpora juros pagos pelos tomadores. A reserva do DAO reduz a parcela do juro que chega aos fornecedores. O risco de dívida ruim pode reduzir o índice de liquidez, e uma corrida de resgates pode encontrar menos sBTC imediatamente disponível.

### 4.2 `zvstBTC`

Para o vault alavancado, a aproximação conceitual é:

```text
retorno líquido do zvstBTC
≈ recompensa bruta de Bitcoin Staking
+ efeito da alavancagem
− juros de sBTC tomado
− fees da estratégia e da Stacking DAO
− custos de conversão/liquidez
− perdas por liquidação, depeg ou falhas
− performance fee e eventual express fee
```

O código mainnet documentado inicializa taxa de gestão, performance fee de 10% sobre ganho acima do high-water mark, exit fee zero e express fee de 0,5% quando a saída expressa está habilitada. Esses parâmetros devem ser confirmados no estado vigente; não são suficientes para calcular um APY real sem saldos, taxas e datas. [5] [23]

O alvo de 6–8% APY é, portanto, uma meta de estratégia. Não deve ser comparado diretamente com o aproximadamente 1,5% de marketing do Stacks Market ou com o “up to 3%” da home sem informar produto, moeda, período, composição e custos.

## 5. Comparação arquitetural com a RendeBit

A comparação a seguir usa o fluxo informado no pedido — **entrada por Pix/BRL, passagem pela Binance, bridge de BTC para sBTC e uso de stBTC**. Não foi localizada, no conjunto de fontes consultadas, documentação primária da RendeBit que confirme contratos, custódia, taxas, parceiros, limites ou fórmula de rendimento. Assim, a coluna RendeBit descreve a arquitetura presumida pelo fluxo, não uma auditoria da implementação.

| Dimensão | Zest Protocol | RendeBit conforme o fluxo indicado | Implicação de implementação |
|---|---|---|---|
| Entrada do usuário | Carteira Stacks/Bitcoin e ativos on-chain; não há Pix como componente do protocolo | Pix deposita BRL; a experiência começa em moeda fiduciária | É necessário separar o ledger BRL, conciliação bancária, KYC/AML e o ledger cripto; Pix não produz rendimento BTC |
| Compra/conversão | BTC pode ser convertido para sBTC pelo peg da Stacks; o Zest recebe sBTC já emitido | Binance funciona como rail de compra, conversão, liquidez ou custódia, conforme o desenho da RendeBit | Binance é uma dependência de execução/custódia; suas taxas, limites, disponibilidade e risco de contraparte entram no retorno líquido |
| Bridge | sBTC é emitido em Stacks contra infraestrutura de peg, com signers e UTXO Bitcoin; não é um bridge operado pelo Zest | O fluxo exige bridge BTC → sBTC antes de usar os produtos Stacks | Deve haver reconciliação de quantidade, status do peg-in, confirmações, erros e tempo de peg-out |
| Ativo de lending | `sBTC` no `v0-vault-sbtc`; fornecedor recebe `zsBTC` | Pode usar sBTC como ativo intermediário, mas o produto final pode ser um saldo interno da RendeBit | Não confundir saldo da aplicação com sBTC resgatável; registrar prova de reservas e passivos por unidade |
| Staking líquido | `stBTC` via Stacking DAO; `zvstBTC` pode tomar sBTC e comprar/estacar mais stBTC | O fluxo indicado também usa stBTC, presumivelmente para capturar rendimento de Bitcoin Staking | A RendeBit precisa definir se apenas repassa stBTC, se alavanca, ou se agrega um vault próprio; cada opção muda risco e contabilidade |
| Fonte do retorno | Juros de tomadores em sBTC; ou recompensas PoX-5 via stBTC; incentivos em STX são separados | Deve ser especificado se o retorno vem de lending, staking, spread, tesouraria, incentivo ou combinação | Sem decomposição por fonte, “rendimento BTC” pode mascarar subsídio temporário, alavancagem ou risco de contraparte |
| Moeda do pagamento | Supply: sBTC; `zvstBTC`: saída documentada em stBTC; BTC nativo só por peg-out ou rota própria | Pode exibir BRL, BTC, sBTC ou um saldo interno | A interface deve declarar unidade de principal, unidade de retorno, câmbio aplicado e se há conversão automática |
| Custódia | Zest usa contratos Clarity; sBTC depende da infraestrutura da Stacks; stBTC depende da Stacking DAO | Pode haver custódia bancária, custódia Binance, smart contracts e/ou contas omnibus | O risco não é um único risco: soma risco bancário, exchange, bridge, token, protocolo e estratégia |
| Saída | Resgate de `zsBTC` depende de liquidez; stBTC segue request/cooldown/funding/claim; BTC exige peg-out | Pix/BRL pode ser instantâneo apenas se houver liquidez e operação de saída disponíveis | Prometer liquidez diária exige reservas, fila, limites, circuit breaker e plano para congestionamento ou depeg |
| Exposição cambial | O retorno é principalmente BTC-denominated; o protocolo não resolve BRL/BTC | O usuário começa em BRL e pode avaliar retorno em BRL | Deve separar retorno do ativo BTC, variação BTC/BRL, spread da Binance, tarifas Pix e taxas da plataforma |
| Governança e risco | DAO, parâmetros de egroup, oracles Pyth/DIA, contratos auditados e riscos de peg | Depende de quem controla chaves, limites, rebalanço, Binance e conversões | São necessários segregação de poderes, logs, limites de exposição, pausas e reconciliação independente |

A principal diferença é que **Pix e Binance são rails de aquisição, liquidação ou custódia; eles não são, por si, a fonte econômica do rendimento BTC**. Na arquitetura Zest, a origem documentada está nos juros pagos por tomadores de sBTC e nas recompensas do Bitcoin Staking capturadas por stBTC. Se a RendeBit anuncia um rendimento, deve publicar qual parte é rendimento orgânico, qual parte é incentivo e qual parte é resultado de variação de preço ou conversão BRL/BTC.

## 6. Riscos e implicações de implementação

### 6.1 Risco de representação e peg

sBTC tem alvo 1:1, mas depende de um processo operacional e criptográfico de peg. O usuário que começa com BTC nativo assume risco de signer set, confirmação, disponibilidade e retirada. O fato de um contrato do Zest aceitar sBTC não elimina esse risco, pois o Zest não é a ponte nem controla o UTXO de backing. [9] [10] [11]

stBTC adiciona outra camada: a relação econômica com sBTC, a gestão das posições de PoX-5, os contratos da Stacking DAO, a liquidez de resgate e a possibilidade de descolamento. Para uma aplicação que promete BTC, é necessário definir se “BTC” significa BTC nativo, sBTC, stBTC, ou um valor de mercado convertido.

### 6.2 Risco de taxa, liquidação e alavancagem

No lending, uma utilização elevada pode elevar a taxa de borrow e reduzir a liquidez livre. No `zvstBTC`, o custo do borrow de sBTC reduz diretamente o diferencial entre staking yield e retorno líquido. Se o valor do colateral cair, se a dívida subir ou se o oracle mudar, o LTV pode cruzar os limiares de liquidação. O V2 admite liquidações parciais e totais com penalidades graduais, mas isso não elimina perda de colateral, gap de preço ou execução tardia. [13] [24]

A alavancagem também transforma um rendimento de staking em um produto de crédito. Uma interface que apresente somente o APY bruto do stBTC sem exibir dívida, LTV, borrow APR, health factor e cenário de perda induz a uma leitura incompleta do risco.

### 6.3 Risco de liquidez e resgate

O valor de uma cota não é o mesmo que liquidez imediata. O fornecedor pode ver seu `zsBTC` valorizado e ainda enfrentar resgate limitado porque o subjacente está emprestado. No `zvstBTC`, há cooldown, funding e claim; a saída pode ser em stBTC, não em BTC nativo. Uma implementação responsável deve exibir liquidez disponível, utilização, fila, prazo estimado, limite de resgate e comportamento em pausa.

### 6.4 Oracles, tokens e configurações

O mercado documenta Pyth Lazer como oracle primário e DIA para determinados ativos, com verificações de frescor, positividade e timestamps. O risco residual inclui dados externos incorretos, feed indisponível, transformação de preços de ztokens, stSTX e ativos com depeg. O registro pode habilitar colateral e dívida separadamente; a presença de um contrato no repositório não prova que toda combinação esteja aberta no bloco de referência. [15] [25]

### 6.5 Smart contracts, governança e auditorias

A publicação de um contrato, uma auditoria ou um bounty reduz risco, mas não garante ausência de bugs, solvência ou recuperação do depósito. O Zest teve um incidente de segurança em V1, com pausa de contratos e reembolso pela tesouraria conforme o comunicado oficial. O V2 é uma arquitetura posterior, mas ainda depende de atualização, pausabilidade, multisig, executor, oracles, integrações externas e parâmetros administráveis. [26] [27] [28]

O DAO pode alterar curvas de juros, caps, parâmetros de risco, oracles, pausas e registro de ativos conforme as regras documentadas. Uma aplicação que integra o protocolo deve monitorar propostas, mudanças de implementação e eventos de pausa; não basta verificar o endereço do contrato uma única vez.

### 6.6 Implicações para uma implementação tipo RendeBit

Se a RendeBit deseja oferecer uma experiência BRL → rendimento BTC, a separação mínima de componentes deveria ser:

| Componente | Pergunta que precisa de resposta | Controle recomendado |
|---|---|---|
| Fiat/Pix | Quem recebe BRL, em que conta e sob qual reconciliação? | Conciliação diária por transação, segregação de fundos e trilha de auditoria |
| Binance | A conta é da empresa, do usuário ou de um parceiro? | Limites de exposição, gestão de chaves/API, allowlists e plano para indisponibilidade |
| Peg BTC/sBTC | Qual é o txid do depósito, quantas confirmações são exigidas e como tratar falha? | Reconciliação BTC/sBTC por unidade, estados idempotentes e prova de reservas |
| Staking/stBTC | O retorno é direto do stBTC ou há alavancagem no Zest? | Exibir NAV, dívida, LTV, borrow rate, cooldown e composição do retorno |
| Rendimento | Qual parcela vem de juros, staking e incentivo? | Relatório de atribuição por fonte, unidade e período |
| Resgate | O cliente recebe BTC, sBTC, stBTC ou BRL? | Política de liquidez, fila, slippage, preço de conversão e circuit breaker |
| Contabilidade | Como são tratados preço, fees, performance fee e imposto? | Ledger de lotes, preço de referência, marcação a mercado e extratos auditáveis |
| Risco | Quais perdas ficam com o cliente e quais com a plataforma? | Termos claros, limites de alavancagem, stress tests e monitoramento 24/7 |

## 7. Conflitos, lacunas e pontos que não devem ser escondidos

1. **APY de marketing:** a home apresenta “up to 3% APY in BTC” e aproximadamente 1,5% APY para o Stacks Market. O `zvstBTC` apresenta alvo de 6–8% APY. São produtos ou mensagens diferentes, variáveis e não garantidos. [1] [4] [8]

2. **Capacidade inicial do `zvstBTC`:** o blog de 3 de setembro de 2026 usa “10 BTC Initial Capacity” no título, enquanto o corpo menciona suporte inicial de até 20 BTC. O número não deve ser escolhido sem confirmação on-chain ou de governança. [29]

3. **Lista de vaults:** a documentação genérica enumera seis vaults e omite stBTC; o README e o deployment mainnet também listam `v0-vault-stbtc`, e a estratégia `zvstBTC` trata stBTC. A lista publicada não prova a habilitação efetiva de cada ativo como colateral ou dívida. [12] [30]

4. **Status dos Bitcoin Collateral Vaults:** “working mainnet prototype”, “Launching in 2026” e “coming soon” não são equivalentes a produto público amplo em produção. A Fase 1 descrita tecnicamente não é o mesmo que o estado final BitVM permissionless. [21] [22]

5. **Programa de incentivos:** o orçamento equivalente a 0,5 BTC é descrito como plano/proposta pago em STX. Não foi encontrada confirmação primária de fórmula final, execução integral, duração ou preço usado na conversão. [7]

6. **BTCz:** o produto baseado em Babylon é histórico e foi oficialmente descontinuado em julho de 2025. Um APY histórico de BTCz não deve ser apresentado como taxa do Zest em setembro de 2026. [31] [32]

7. **xBTC:** não foi encontrada menção a xBTC nas páginas oficiais consultadas, no índice da documentação ou no repositório público V2 revisado. Isso não prova inexistência em terceiros ou interfaces não indexadas; apenas impede tratar xBTC como ativo aceito pelo Zest com base neste corpus.

## 8. Conclusão

A resposta central é econômica antes de ser promocional: **o Zest paga rendimento em unidades denominadas em BTC porque conecta capital BTC-representado a tomadores que pagam juros e/ou a posições de Bitcoin Staking que recebem recompensas PoX-5**. No lending, o canal é `sBTC → zsBTC → juros de tomadores → liquidity index → mais sBTC no resgate`. No vault estratégico, o canal é `stBTC → colateral → empréstimo sBTC → mais stBTC → recompensas de staking`, com dívida e risco de liquidação.

O BTC nativo aparece em duas posições distintas. Ele pode ser convertido para sBTC antes de entrar no Stacks Market, ou pode permanecer em Bitcoin como colateral de um Bitcoin Collateral Vault. A primeira rota é a que explica diretamente o supply yield de sBTC; a segunda explica crédito contra BTC nativo e não deve ser descrita como prova de rendimento BTC automático.

Para medir o retorno corretamente, é preciso divulgar a unidade de pagamento, distinguir APY bruto de líquido, separar juros de tomadores de incentivos em STX, informar alavancagem e descontar taxas, perdas, conversão, liquidez e risco de peg. Sem essa decomposição, “rendimento em BTC” é uma descrição incompleta do mecanismo.

## Limitações

- A análise usa a documentação, o código-fonte e os links de deployment fornecidos para a data de referência, mas não executou uma leitura completa de todos os storage maps nem chamadas RPC no bloco exato de 13/09/2026.
- Não foi calculada a utilização, a dívida, o índice de liquidez, a liquidez livre, o APY realizado ou o saldo do tesouro no momento de referência.
- Parâmetros de curvas, LTV, caps, oracles, fees e grupos de risco podem mudar por governança; exemplos numéricos foram tratados como parâmetros publicados ou ilustrações, não como cotação ao vivo.
- A comparação com RendeBit parte do fluxo descrito no pedido. Não foi encontrada documentação primária suficiente para validar a implementação, custódia, contratos ou política de rendimento da RendeBit.
- O status dos Bitcoin Collateral Vaults permanece ambíguo entre protótipo, lançamento em 2026 e produto “coming soon”.
- A documentação de stBTC e a documentação geral da Stacks apresentam diferenças de atualização e escopo. A análise atribui o desenho operacional ao material específico do `zvstBTC`, sem transformar isso em garantia de disponibilidade.
- Auditorias, bounty e contratos publicados não constituem prova de solvência, seguro, ausência de bugs ou garantia de principal.
- A análise é informativa e não é recomendação de investimento, de integração ou de custódia.

## Nota sobre a RendeBit

Não foram usadas as referências da Binance como prova de uma parceria ou integração específica da RendeBit. Elas são apenas referências gerais para o rail Pix/BRL mencionado no pedido. Qualquer afirmação sobre contas, custódia, spread, taxas ou contratos da RendeBit exige documentação própria ou evidência operacional adicional. [43] [44]

## Declaração final de referência

Este relatório foi redigido com **data de referência em 13/09/2026**. O estado on-chain, a documentação, os parâmetros de governança e as páginas de produto podem mudar depois dessa data.

## References

[1]: https://www.zestprotocol.com/ "Zest Protocol — homepage"
[2]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/vault/v0-vault-sbtc.clar "Zest V2 — contrato mainnet do vault sBTC"
[3]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/proposals/mainnet/v0-init.clar "Zest V2 — parâmetros mainnet e curva de juros"
[4]: https://docs.zestprotocol.com/start/stacks-vaults/zvstbtc-vault.md "Zest — Levered Bitcoin Staking Vault zvstBTC"
[5]: https://docs.zestprotocol.com/start/stacks-vaults/zvstbtc-vault/yield.md "Zest — rendimento e riscos do vault zvstBTC"
[6]: https://docs.stackingdao.com/stackingdao/the-stacking-dao-app/stbtc-liquid-btc-staking-with-btc-rewards/stbtc-basics.md "Stacking DAO — fundamentos do stBTC"
[7]: https://www.zestprotocol.com/blog/defi-incentives-are-coming-to-zest-protocol-stacks-market "Zest — anúncio de incentivos para o Stacks Market"
[8]: https://docs.zestprotocol.com/start/borrow/how-to-use-stacks-market-to-earn-yield.md "Zest — como usar o Stacks Market para obter rendimento"
[9]: https://docs.stacks.co/learn/sbtc.md "Stacks — visão geral do sBTC"
[10]: https://docs.stacks.co/more-guides/sbtc/bridging-bitcoin.md "Stacks — bridge de Bitcoin para sBTC"
[11]: https://docs.stacks.co/more-guides/sbtc/bridging-bitcoin/sbtc-to-btc.md "Stacks — retirada de sBTC para BTC"
[12]: https://docs.zestprotocol.com/start/stacks-market-smart-contracts/v2-contracts/vaults.md "Zest — vaults de ativo único no V2"
[13]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/market/v0-8-market.clar "Zest V2 — contrato mainnet do mercado v0-8"
[14]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/market/v0-market-vault.clar "Zest V2 — contrato mainnet de posições market-vault"
[15]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/registry/v0-assets.clar "Zest V2 — registro mainnet de ativos e oracles"
[16]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/docs/vaults.md "Zest V2 — documentação técnica do sistema de vaults"
[17]: https://docs.zestprotocol.com/start/stacks-market-smart-contracts/v2-contracts/market-contracts/market.md "Zest — operações do contrato de mercado V2"
[18]: https://www.zestprotocol.com/blog/stacks-market-v2-redefining-lending-and-borrowing "Zest — Stacks Market V2: lending, borrowing e não-rehypothecation"
[19]: https://docs.stacks.co/learn/bitcoin-staking.md "Stacks — Bitcoin Staking"
[20]: https://docs.stacks.co/learn/bitcoin-staking/rewards-and-tranches.md "Stacks — recompensas e tranches do Bitcoin Staking"
[21]: https://docs.zestprotocol.com/start/bitcoin-collateral-vaults/introducing-bitcoin-collateral-vaults.md "Zest — introdução aos Bitcoin Collateral Vaults"
[22]: https://docs.zestprotocol.com/start/bitcoin-collateral-vaults/how-zest-protocol-brings-bitcoin-collateral-vaults-to-mainnet.md "Zest — rollout técnico dos Bitcoin Collateral Vaults"
[23]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/strategy-vault/zv-engine-stbtc-0.clar "Zest V2 — engine mainnet da estratégia stBTC"
[24]: https://docs.zestprotocol.com/start/borrow/v2-market-design/liquidations/liquidations-in-stacks-market-v2.md "Zest — liquidações no Stacks Market V2"
[25]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/docs/oracle.md "Zest V2 — arquitetura de oracles"
[26]: https://www.zestprotocol.com/blog/zest-protocol-security-update "Zest — comunicado sobre incidente de segurança no V1"
[27]: https://docs.zestprotocol.com/start/stacks-market-smart-contracts/audits "Zest — auditorias do Stacks Market V2"
[28]: https://immunefi.com/bug-bounty/zest-protocol-v2/scope/ "Immunefi — escopo e exclusões do bounty Zest Protocol V2"
[29]: https://www.zestprotocol.com/blog/initial-capacity-for-zest-protocol-levered-bitcoin-staking-vault "Zest — capacidade inicial do Levered Bitcoin Staking Vault"
[30]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/README.md "Zest V2 — README de deployment mainnet"
[31]: https://www.zestprotocol.com/blog/introducing-zest-protocol-earn-bringing-btc-yield-to-stacks "Zest — anúncio histórico do Zest Protocol Earn e BTCz"
[32]: https://www.zestprotocol.com/blog/sunsetting-btcz-as-zest-evolves "Zest — descontinuação do BTCz"
[33]: https://docs.zestprotocol.com/start/stacks-vaults/zvstbtc-vault/deposits-and-withdrawals.md "Zest — depósitos e retiradas do vault zvstBTC"
[34]: https://explorer.hiro.so/address/SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-8-market?chain=mainnet "Stacks Explorer — contrato v0-8-market em mainnet"
[35]: https://docs.zestprotocol.com/start/borrow/v2-market-design/interest-rates-mechanism.md "Zest — mecanismo de taxas de juros V2"
[36]: https://docs.zestprotocol.com/start/stacks-vaults/introducing-stacks-vaults.md "Zest — introdução aos Stacks Vaults"
[37]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/contracts/strategy-vault/zv-ops-stbtc-0.clar "Zest V2 — operações mainnet da estratégia stBTC"
[38]: https://docs.zestprotocol.com/start/zest-protocol-overview.md "Zest — visão geral do protocolo"
[39]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/docs/High-Level-Overview.md "Zest V2 — visão geral de alto nível da arquitetura"
[40]: https://docs.zestprotocol.com/start/borrow/how-to-use-stacks-market-to-borrow-assets.md "Zest — como tomar ativos emprestados no Stacks Market"
[41]: https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/docs/egroups.md "Zest V2 — grupos de risco e parâmetros de egroup"
[42]: https://docs.stacks.co/learn/sbtc/sbtc-signers.md "Stacks — signers do sBTC"
[43]: https://www.binance.com/en/support/faq/detail/b90065c7a7d44d0bb8b2ac7dc2cb0391 "Binance — compra de cripto com BRL via Pix"
[44]: https://www.binance.com/en/support/faq/detail/ceb63b7440ab480794fac517ae8ff8d9 "Binance — uso de Pix para pagamentos em BRL"
