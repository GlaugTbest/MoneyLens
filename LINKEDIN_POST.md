# Postagem para LinkedIn

Há algumas semanas compartilhei que estava começando a estudar Open Finance e a construir uma aplicação para entender melhor como dados financeiros podem ser integrados sem que o usuário entregue sua senha à aplicação.

Agora cheguei a uma primeira versão desse projeto: o **MoneyLens**.

Foi, até aqui, o projeto mais complexo que desenvolvi. Mais do que pelo tamanho do código, ele me obrigou a parar em conceitos que eu conhecia só de forma superficial e entender como eles se conectam na prática.

Alguns dos pontos que mais exigiram estudo foram:

- autenticação com tokens de acesso e renovação segura de sessão;
- consentimento e conexão com instituições via Pluggy Connect, usando ambiente sandbox;
- sincronização assíncrona com filas, webhooks e tentativas de recuperação;
- normalização e categorização de transações;
- isolamento de dados entre usuários;
- leitura crítica dos números exibidos: uma métrica financeira precisa deixar claro o que está somando e quais são suas limitações.

O MoneyLens conecta contas de teste, sincroniza transações em segundo plano, categoriza movimentos com regras e, opcionalmente, usa IA como fallback. A aplicação também calcula recorrências e aponta gastos fora do padrão a partir de heurísticas simples.

Uma das partes mais interessantes foi perceber que o “gráfico pronto” é a etapa mais visível, mas não necessariamente a mais difícil. Antes dele existem decisões sobre segurança, consistência, falhas de integração, atualização dos dados e como não induzir o usuário a interpretar uma estimativa como verdade absoluta.

O projeto continua como MVP e utiliza apenas dados de sandbox. A intenção foi aprender a construir uma base mais responsável para esse tipo de integração, não lançar um produto financeiro pronto para uso real.

Deixo o repositório no GitHub como registro do processo e para continuar evoluindo a partir daqui: **[adicione aqui o link do repositório]**

#OpenFinance #Fintech #APIs #NodeJS #NextJS #NestJS #PostgreSQL #Redis #DesenvolvimentoDeSoftware #Programação
