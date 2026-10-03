FROM node:24-bookworm-slim
WORKDIR /workspace
COPY . .
RUN npm install --no-audit --no-fund
EXPOSE 3000 4000 4100
CMD ["npm", "run", "dev"]
