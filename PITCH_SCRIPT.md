# PITCH SCRIPT: Aegis402 B2B M2M Gateway

## Tema Central
Aegis402 não é apenas uma carteira ou um chatbot. É um **Gateway de Infraestrutura B2B (M2M Payment Firewall)** desenhado para aprovar microtransações autônomas (via protocolo L402) em redes fechadas/pools de agentes (Testnet Soroban) com Zero-Knowledge.

---

### [00:00 - 00:30] A Dores Atuais do M2M
**Fala:**
"Hoje, se sua empresa opera cinco Agentes de IA que consomem APIs pagas autonomamente, gerenciar os pagamentos web3 desses agentes é um caos. Se o Agente 01 enlouquecer, ele drena toda a carteira da empresa. Conectamos o Aegis402 para resolver esse risco sistêmico."

**Ação:**
- Mostre o Painel da Tesouraria Corporativa (Esquerda). Destaque os **9 milhões de XLM** da Company e o *Shielded Pool Balance*.
- "O orçamento da frota não fica exposto. Ele fica em um Smart Contract selado (Aegis Pool), nutrido estrategicamente."

---

### [00:30 - 01:15] A Demonstração do Firewall Rate Limit
**Fala:**
"Aqui no painel direito, temos a nossa frota de Agentes simulados. E aqui mora o Firewall. Reduzo o limite do Alpha DataNode para quase Zero..."

**Ação:**
- Deslize o slider do **Alpha DataNode** para um valor menor que 5 XLM.
- Mostre o card brilhando em vermelho: `FIREWALL ACTIVE`.
- **Clique** no botão de simulação do Alpha DataNode.
- **Destaque:** O clique falhará instantaneamente e gerará o log: `[FIREWALL] Transaction blocked...`
- **Fala:** "Ele tentou gastar sozinho sem saldo no limite corporativo. O nosso gateway B2B o intercepta antes mesmo de alcançar a rede."

---

### [01:15 - 02:00] A Execução Perfeita (Protocolo Híbrido MPP + V1)
**Fala:**
"Agora, damos um orçamento decente ao Zeta Reasoner e ele detecta uma demanda..."

**Ação:**
- Deslize o limite do **Zeta Reasoner** acima de 10 XLM.
- **Clique** em simular "AI Reasoning".
- Mostre a mágica no *Security & Payment Audit Log*. Ele vai disparar o L402 Challenge, bater no Orchestrator, assinar na Soroban e confirmar a transação.
- **Fala:** "Em um milissegundo, a requisição sofre M2M Shielding, paga via Testnet e cai no log. Clicando no Hash em azul/ciano, vocês podem ver o selo holográfico diretamente na Stellar Expert."
- **Ação:** Clique no link do Hash gerado.

---

### [02:00 - 02:30] O Pulo do Gato: IA Auditora
**Fala:**
"Mas orquestrar pagamentos não é o suficiente em B2B. O quão auditável é isso? Adicionamos a mente do Gemini por trás da blockchain operando como nosso 'Aegis Auditor'."

**Ação:**
- Mostre a última linha azul arroxeada no log, a tag `[AI AUDIT]`.
- **Fala:** "O Gemini recebe assincronamente os meta-dados transacionais liquidadores da Soroban e elabora compliance logs em tempo real sem expor o payload bruto. Nós conectamos a auditoria da IA Generativa na pipeline transacional M2M!"

---

### [02:30 - 03:00] Compliance & Encerramento
**Fala:**
"No final do mês fiscal, a transparência B2B é obrigatória. Um clique aqui exporta o balanço de toda a rede criptografada."

**Ação:**
- **Clique no íncone de Download** acima da janela do Log. Mostre que o arquivo `.txt` é gerado.
- "Aegis402. Seguro. Híbrido. Feito com Google AI e a velocidade imbatível da Stellar. Obrigado."
