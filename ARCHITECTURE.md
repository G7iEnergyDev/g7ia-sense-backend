# Arquitetura

O projeto usa uma separação em camadas. As rotas lidam somente com HTTP; os controladores validam a requisição e escolhem a resposta; os serviços concentram regras de negócio; os repositórios contêm o acesso ao PostgreSQL.

```text
src/
├── config/         Variáveis de ambiente e configuração
├── database/       Pool único de conexão PostgreSQL
├── models/         Tipos do domínio (usuário, dispositivo e período)
├── middlewares/    Comportamentos transversais, como autenticação
├── routes/         Mapeamento de URLs e middlewares
├── controllers/    Entrada HTTP e códigos de resposta
├── services/       Casos de uso e regras de negócio
└── repositories/   Consultas ao banco de dados
```

## Fluxo de uma requisição autenticada

```text
rota → middleware JWT → controller → service → repository → PostgreSQL
```

Para uma nova funcionalidade, crie o repositório se houver uma nova fonte de dados, implemente a regra no serviço, exponha-a no controlador e por fim registre a rota em `src/routes/index.ts`.

## Documentação da API

Com a aplicação em execução, a documentação interativa Swagger está disponível em `http://localhost:3333/documentation`. O documento OpenAPI em JSON pode ser obtido em `http://localhost:3333/documentation/json`.

As rotas protegidas usam o esquema `bearerAuth`. Clique em **Authorize** na interface e informe o access token do Keycloak no formato `Bearer <token>`.
