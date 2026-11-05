FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY shared/experience/package.json shared/experience/package.json
COPY shared/api-contract/package.json shared/api-contract/package.json
COPY shared/api/refinement-server/package.json shared/api/refinement-server/package.json
COPY shared/api/ai-form-ui-contract/package.json shared/api/ai-form-ui-contract/package.json
COPY apps/designer/package.json apps/designer/package.json
COPY apps/widget/package.json apps/widget/package.json
COPY apps/shopify/package.json apps/shopify/package.json
RUN npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build -w @adventure/experience && npm run build -w @adventure/api-contract && npm run build -w @adventure/backend
ENV NODE_ENV=production
CMD ["node", "apps/backend/dist/main.js"]
