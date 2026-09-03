require('dotenv').config();

const app = require('./src/app');

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`SACWare ERP API escuchando en http://localhost:${port}`);
});
